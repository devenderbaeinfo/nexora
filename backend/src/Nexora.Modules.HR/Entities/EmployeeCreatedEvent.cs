using Nexora.Shared.Common;

namespace Nexora.Modules.HR.Entities;

// Raised wherever an Employee row is first created (EmployeesController, UsersController's
// combined create-account-and-employee flow). A second, deliberately separate module from
// Workflow so the event pipeline proves itself generic across the codebase, not leave-only.
public sealed record EmployeeCreatedEvent(Guid EmployeeId, string FullName) : DomainEvent;
