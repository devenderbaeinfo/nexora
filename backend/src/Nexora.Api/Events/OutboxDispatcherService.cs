using System.Text.Json;
using Nexora.Shared.Common;
using Nexora.Shared.Events;
using Nexora.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Nexora.Api.Events;

// The only background worker in the system today — polls the Outbox and dispatches whatever
// hasn't been processed yet. A single instance is enough at this scale (one process, one
// deployable unit, per the modular-monolith mandate); this is not meant to survive being
// scaled to multiple instances without adding a claim/lease step first.
public class OutboxDispatcherService(
    IServiceScopeFactory scopeFactory,
    ILogger<OutboxDispatcherService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    private const int MaxAttempts = 5;
    private const int BatchSize = 25;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Outbox dispatch loop failed; will retry next poll.");
            }

            try { await Task.Delay(PollInterval, stoppingToken); }
            catch (OperationCanceledException) { }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NexoraDbContext>();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IEventDispatcher>();

        // IgnoreQueryFilters is deliberate and safe here: this is the one piece of
        // infrastructure that must see every tenant's pending events in one pass, not just
        // one tenant's — there is no ambient tenant in a background job to filter by anyway
        // (see ITenantContext.IsResolved == false outside a request).
        var pending = await db.OutboxMessages
            .IgnoreQueryFilters()
            .Where(m => m.ProcessedAtUtc == null && m.Attempts < MaxAttempts)
            .OrderBy(m => m.OccurredAtUtc)
            .Take(BatchSize)
            .ToListAsync(ct);

        if (pending.Count == 0) return;

        foreach (var message in pending)
        {
            try
            {
                var eventType = Type.GetType(message.EventType)
                    ?? throw new InvalidOperationException($"Unknown event type '{message.EventType}'.");
                var domainEvent = (IDomainEvent?)JsonSerializer.Deserialize(message.PayloadJson, eventType)
                    ?? throw new InvalidOperationException("Event payload deserialized to null.");

                await dispatcher.DispatchAsync(domainEvent, message.TenantId, ct);
                message.ProcessedAtUtc = DateTimeOffset.UtcNow;
            }
            catch (Exception ex)
            {
                message.Attempts++;
                message.LastError = ex.Message;
                logger.LogError(ex, "Outbox message {MessageId} ({EventType}) failed on attempt {Attempt}.",
                    message.Id, message.EventType, message.Attempts);
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
