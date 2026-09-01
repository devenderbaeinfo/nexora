namespace Erp.Api.Contracts;

public record SalaryComponentInput(string Name, string Type, string CalculationType, decimal Value, bool IsBasic);

public record SetSalaryStructureRequest(DateOnly EffectiveFrom, List<SalaryComponentInput> Components);

public record SalaryComponentDto(Guid Id, string Name, string Type, string CalculationType, decimal Value, bool IsBasic, int SortOrder);

public record SalaryStructureDto(Guid Id, Guid EmployeeId, DateOnly EffectiveFrom, bool IsActive, List<SalaryComponentDto> Components);

public record ProcessPayrollRequest(int PeriodMonth, int PeriodYear);

public record PayrollRunDto(
    Guid Id, int PeriodMonth, int PeriodYear, string Status,
    int PayslipCount, decimal TotalNetPay,
    DateTimeOffset CreatedAtUtc, DateTimeOffset? ApprovedAtUtc, DateTimeOffset? DisbursedAtUtc,
    Guid? JournalEntryId, List<string> SkippedEmployeeNames);

public record PayslipListItemDto(
    Guid Id, Guid EmployeeId, string EmployeeName,
    decimal GrossEarnings, decimal LopDays, decimal LopDeduction, decimal OtherDeductions, decimal NetPay);

public record PayslipLineDto(string ComponentName, string Type, decimal Amount);

public record PayslipDetailDto(
    Guid Id, Guid PayrollRunId, int PeriodMonth, int PeriodYear, string EmployeeName,
    int DaysInMonth, decimal LopDays, decimal GrossEarnings, decimal LopDeduction,
    decimal OtherDeductions, decimal NetPay, List<PayslipLineDto> Lines);
