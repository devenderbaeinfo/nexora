namespace Erp.Api.Contracts;

public record JobTitleDto(Guid Id, string Name, string SystemRole);
public record CreateJobTitleRequest(string Name, string SystemRole);
public record UpdateJobTitleRequest(string Name, string SystemRole);
