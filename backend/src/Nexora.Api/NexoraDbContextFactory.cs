using Nexora.Api.Persistence;
using Nexora.Shared.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Nexora.Api;

// Used only by `dotnet ef migrations add` at design time — no HTTP request exists yet,
// so tenant scoping is irrelevant here; migrations operate on the schema, not tenant rows.
public class NexoraDbContextFactory : IDesignTimeDbContextFactory<NexoraDbContext>
{
    private class DesignTimeTenantContext : ITenantContext
    {
        public Guid TenantId => Guid.Empty;
        public bool IsResolved => false;
    }

    public NexoraDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json")
            .Build();

        var options = new DbContextOptionsBuilder<NexoraDbContext>()
            .UseSqlServer(config.GetConnectionString("Default"))
            .Options;

        return new NexoraDbContext(options, new DesignTimeTenantContext());
    }
}
