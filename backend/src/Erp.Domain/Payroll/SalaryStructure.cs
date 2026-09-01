using Erp.Domain.Common;

namespace Erp.Domain.Payroll;

public enum SalaryComponentType { Earning, Deduction }

// PercentageOfBasic reads off whichever SalaryComponent on the same structure has
// IsBasic = true — exactly one earning component per structure must be flagged as Basic,
// enforced in PayrollController, not here (a cross-row rule, same reasoning as
// JournalEntry's balance check living in AccountingController).
public enum SalaryCalculationType { FixedAmount, PercentageOfBasic }

// One per employee, append-only like EmployeeAssignmentHistory: setting a new structure
// deactivates the old one instead of editing it in place, so a payslip calculated last
// quarter stays explainable even after a raise changes the current numbers.
public class SalaryStructure : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SalaryComponent : TenantEntity
{
    public Guid SalaryStructureId { get; set; }
    public string Name { get; set; } = default!;
    public SalaryComponentType Type { get; set; }
    public SalaryCalculationType CalculationType { get; set; }

    // FixedAmount: the amount itself. PercentageOfBasic: the percentage number (e.g. 40 for 40%).
    public decimal Value { get; set; }

    // Exactly one Earning component per structure. FixedAmount only — Basic can't be
    // defined as a percentage of itself.
    public bool IsBasic { get; set; }
    public int SortOrder { get; set; }
}
