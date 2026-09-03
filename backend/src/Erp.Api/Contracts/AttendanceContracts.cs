namespace Erp.Api.Contracts;

public record AttendanceEntryDto(
    Guid Id, Guid EmployeeId, string EmployeeName, DateOnly WorkDate,
    DateTimeOffset ClockIn, DateTimeOffset? ClockOut,
    decimal? RegularHours, decimal? OvertimeHours);

public record CorrectAttendanceRequest(DateTimeOffset ClockIn, DateTimeOffset? ClockOut);

public record AttendanceSettingsDto(decimal StandardWorkDayHours);
public record UpdateAttendanceSettingsRequest(decimal StandardWorkDayHours);
