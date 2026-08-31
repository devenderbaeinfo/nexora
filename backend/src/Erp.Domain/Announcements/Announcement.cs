using Erp.Domain.Common;

namespace Erp.Domain.Announcements;

public enum AnnouncementCategory
{
    Announcement,
    Policy
}

// Shown on every page of the client shell — HR-authored, read-only for everyone else in
// the tenant. A Policy (e.g. POSH, leave conditions) is expected to stay pinned indefinitely;
// a plain Announcement is expected to scroll off once newer ones push it down.
public class Announcement : TenantEntity
{
    public string Title { get; set; } = default!;
    public string Body { get; set; } = default!;
    public AnnouncementCategory Category { get; set; } = AnnouncementCategory.Announcement;
    public bool IsPinned { get; set; }
    public Guid PublishedByUserId { get; set; }
}
