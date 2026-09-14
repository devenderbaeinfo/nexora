namespace Nexora.Modules.HR.Services;

// Local-disk storage for uploaded employee documents, one folder per tenant so a path
// leak in application code still can't cross a tenant boundary at the filesystem level.
// Swappable for cloud blob storage later behind the same three methods.
public class EmployeeDocumentStorage
{
    private readonly string _rootPath;

    public EmployeeDocumentStorage(IWebHostEnvironment env)
    {
        _rootPath = Path.Combine(env.ContentRootPath, "App_Data", "employee-documents");
        Directory.CreateDirectory(_rootPath);
    }

    public async Task<string> SaveAsync(Guid tenantId, IFormFile file)
    {
        var tenantDir = Path.Combine(_rootPath, tenantId.ToString());
        Directory.CreateDirectory(tenantDir);

        var storedFileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var fullPath = Path.Combine(tenantDir, storedFileName);

        await using var stream = File.Create(fullPath);
        await file.CopyToAsync(stream);

        return storedFileName;
    }

    public string GetPath(Guid tenantId, string storedFileName) =>
        Path.Combine(_rootPath, tenantId.ToString(), storedFileName);
}
