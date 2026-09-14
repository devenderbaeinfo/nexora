using Nexora.Modules.Finance.Entities;
using Nexora.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Finance.Seed;

// A minimal starter Chart of Accounts per tenant, additive like RolePermissionSync/
// JobTitleSync — enough for Finance to post their first journal entry without having
// to hand-create every account first. Finance can add more via the Chart of Accounts page.
public static class AccountSync
{
    private static readonly (string Code, string Name, AccountType Type, bool IsCash)[] DefaultAccounts =
    [
        ("1000", "Cash", AccountType.Asset, true),
        ("1100", "Accounts Receivable", AccountType.Asset, false),
        ("2000", "Accounts Payable", AccountType.Liability, false),
        ("3000", "Owner's Equity", AccountType.Equity, false),
        ("4000", "Revenue", AccountType.Revenue, false),
        ("5000", "Operating Expenses", AccountType.Expense, false),
    ];

    public static async Task RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NexoraDbContext>();

        var tenants = await db.Tenants.IgnoreQueryFilters().ToListAsync();
        var existingByTenant = (await db.Accounts.IgnoreQueryFilters().ToListAsync())
            .GroupBy(a => a.TenantId)
            .ToDictionary(g => g.Key, g => g.Select(a => a.Code).ToHashSet());

        foreach (var tenant in tenants)
        {
            var existing = existingByTenant.GetValueOrDefault(tenant.Id, []);
            foreach (var (code, name, type, isCash) in DefaultAccounts)
            {
                if (existing.Contains(code)) continue;
                db.Accounts.Add(new Account { TenantId = tenant.Id, Code = code, Name = name, Type = type, Currency = tenant.BaseCurrencyCode, IsCashAccount = isCash });
            }
        }

        await db.SaveChangesAsync();
    }
}
