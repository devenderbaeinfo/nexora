using Erp.Domain.Announcements;

namespace Erp.Api.Contracts;

public record AnnouncementDto(
    Guid Id, string Title, string Body, string Category, bool IsPinned, DateTimeOffset CreatedAtUtc);

public record UpsertAnnouncementRequest(string Title, string Body, AnnouncementCategory Category, bool IsPinned);
