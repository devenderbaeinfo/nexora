using System.Reflection;
using Nexora.Shared.Common;
using Microsoft.Extensions.DependencyInjection;

namespace Nexora.Shared.Events;

public interface IEventDispatcher
{
    Task DispatchAsync(IDomainEvent domainEvent, Guid tenantId, CancellationToken ct);
}

// Routes a deserialized event to every IDomainEventHandler<TConcreteEvent> registered for its
// runtime type. Reflection-based because the outbox only knows the concrete type after
// deserializing JSON — there's no compile-time generic to dispatch through. This runs from a
// background job, not a request hot path, so the reflection cost is a non-issue.
public class EventDispatcher(IServiceProvider serviceProvider) : IEventDispatcher
{
    public async Task DispatchAsync(IDomainEvent domainEvent, Guid tenantId, CancellationToken ct)
    {
        var handlerType = typeof(IDomainEventHandler<>).MakeGenericType(domainEvent.GetType());
        var handlers = serviceProvider.GetServices(handlerType);
        var handleMethod = handlerType.GetMethod("HandleAsync")
            ?? throw new InvalidOperationException($"{handlerType} has no HandleAsync method.");

        foreach (var handler in handlers)
        {
            if (handler is null) continue;
            // Every handler must tolerate re-delivery of the same event — the outbox guarantees
            // at-least-once processing, not exactly-once (a crash between running a handler and
            // marking the message processed means it can be retried).
            var task = (Task)handleMethod.Invoke(handler, [domainEvent, tenantId, ct])!;
            await task;
        }
    }
}
