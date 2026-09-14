namespace Nexora.Modules.HR.Contracts;

public record TimesheetEntryDto(
    Guid Id, string EmployeeName, string ProjectName, DateOnly WorkDate,
    decimal Hours, bool IsBillable, string? Notes, string Status);

public record SubmitTimesheetRequest(Guid ProjectId, DateOnly WorkDate, decimal Hours, bool IsBillable, string? Notes);

public record DecideTimesheetRequest(bool Approve);
