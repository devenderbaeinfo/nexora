using System.Text;
using System.Threading.RateLimiting;
using Nexora.Shared.Authorization;
using Nexora.Shared.Common;
using Nexora.Shared.Events;
using Nexora.Api.Authorization;
using Nexora.Api.Events;
using Nexora.Api.Persistence;
using Nexora.Modules.Identity.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Identity.Services;
using Nexora.Modules.HR.Services;
using Nexora.Modules.Finance.Services;
using Nexora.Modules.Workflow.Entities;
using Nexora.Modules.Workflow.Services;
using Nexora.Modules.Platform.Services;
using Nexora.Shared.Tenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(opt => opt.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddOpenApi();

// Global exception handling: every unhandled exception, anywhere in the API, gets logged
// server-side and returns the same sanitized ProblemDetails response — see the handler
// itself for why this replaced "whatever the framework default happens to do."
builder.Services.AddExceptionHandler<Nexora.Shared.Middleware.GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// --- Persistence & multi-tenancy -------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantContext, JwtTenantContext>();
builder.Services.AddScoped<IApprovalWorkflowService, ApprovalWorkflowService>();
builder.Services.AddScoped<Nexora.Modules.HR.Services.IApprovalChainResolver, Nexora.Modules.HR.Services.ApprovalChainResolver>();
builder.Services.AddScoped<IAccountingPostingService, AccountingPostingService>();
builder.Services.AddSingleton<Nexora.Modules.HR.Services.EmployeeDocumentStorage>();
builder.Services.AddScoped<IDataScopeService, DataScopeService>();
builder.Services.AddScoped<IReportAccessService, ReportAccessService>();
builder.Services.AddScoped<IRoleUsageChecker, JobTitleRoleUsageChecker>();
builder.Services.AddScoped<IEmployeeDirectory, EmployeeDirectory>();
builder.Services.AddScoped<IProjectDirectory, Nexora.Modules.Projects.Services.ProjectDirectory>();
builder.Services.AddScoped<IBillingProviderGateway, ManualBillingProviderGateway>();
builder.Services.AddDbContext<NexoraDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
// Modules depend only on the base EF Core DbContext type (never NexoraDbContext directly),
// so they never need a project reference to Nexora.Api, which owns the concrete context.
builder.Services.AddScoped<DbContext>(sp => sp.GetRequiredService<NexoraDbContext>());

// --- Domain events / Outbox --------------------------------------------------------
// Scoped (not Singleton): it's only ever resolved from inside the per-poll scope that
// OutboxDispatcherService creates, so it should share that scope's NexoraDbContext-dependent
// handlers rather than capture the root provider.
builder.Services.AddScoped<IEventDispatcher, EventDispatcher>();
builder.Services.AddScoped<IDomainEventHandler<WorkflowApprovalCompletedEvent>,
    Nexora.Modules.Workflow.Services.WorkflowApprovalAuditHandler>();
builder.Services.AddScoped<IDomainEventHandler<Nexora.Modules.HR.Entities.EmployeeCreatedEvent>,
    Nexora.Modules.HR.Services.EmployeeCreatedAuditHandler>();
builder.Services.AddHostedService<OutboxDispatcherService>();

builder.Services
    .AddIdentityCore<AppUser>(opt =>
    {
        // Deliberately strict defaults for a product that will hold payroll and expense data.
        opt.Password.RequiredLength = 12;
        opt.Password.RequireNonAlphanumeric = true;
        opt.Password.RequireUppercase = true;
        opt.Lockout.MaxFailedAccessAttempts = 5;
        opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        opt.User.RequireUniqueEmail = true; // login is by email alone now — no workspace field, so this must be global
    })
    .AddRoles<AppRole>()
    .AddEntityFrameworkStores<NexoraDbContext>()
    .AddDefaultTokenProviders(); // required for password-reset tokens (UsersController.ResetPassword)

// --- AuthN / AuthZ -----------------------------------------------------------------
var jwtKey = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey is not configured.");

// IAM-13: presence alone isn't enough — the checked-in appsettings.json placeholder is a
// syntactically valid, real string, so a deploy that forgets to override it via user-secrets/
// env var would otherwise start up "successfully" while every token is signed with a key an
// attacker can read straight out of source control. Development is exempt so `dotnet run`
// against a fresh clone still works with zero setup.
if (!builder.Environment.IsDevelopment())
{
    const string placeholder = "CHANGE_ME_USE_DOTNET_USER_SECRETS_OR_ENV_VAR_MIN_32_CHARS";
    if (jwtKey == placeholder || jwtKey.Length < 32)
    {
        throw new InvalidOperationException(
            "Jwt:SigningKey is missing, is the checked-in placeholder, or is too short (min 32 chars). " +
            "Set a real value via an environment variable or a secrets manager before deploying.");
    }
}

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorization();

// Login is rate-limited per client IP, independent of Identity's own per-account lockout,
// so a distributed credential-stuffing attempt can't just spread failed attempts across accounts.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    // Two more targeted policies beyond login: password reset (an attacker probing account
    // existence via reset requests) and search (cheap to hammer, no reason to allow unlimited
    // calls per second from one caller). Both are per-IP, looser than login's since they're
    // behind auth already, but not unlimited.
    options.AddPolicy("sensitive-action", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    options.AddPolicy("search", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    options.RejectionStatusCode = 429;

    // IAM-16: everything else was completely unthrottled — a single caller could otherwise
    // hammer any authenticated endpoint (payroll runs, reports, exports) with no limit at all.
    // This global limiter sits underneath the named policies above (an endpoint tagged
    // [EnableRateLimiting("login")] etc. still gets its own tighter limit); it's sized to only
    // ever catch abuse, not normal UI usage (dashboards firing a handful of parallel requests
    // on load, polling every 30s, etc.).
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        // IAM-15: the frontend only ever sends Authorization + Content-Type, and only ever
        // uses these five methods — AllowAnyHeader/AllowAnyMethod was strictly wider than
        // anything the app actually needs, for no benefit.
        policy.WithOrigins(origins)
            .WithHeaders("Content-Type", "Authorization")
            .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // spec at /openapi/v1.json — no UI wired up yet, use Swagger/Postman/curl against it
}
else
{
    // HSTS only makes sense once there's a real cert chain in front of this — harmless to
    // enable, but only actually protects anything (repeat-visit downgrade attacks) outside Development.
    app.UseHsts();
}

app.UseExceptionHandler(); // must run before anything that could throw — first real middleware in the pipeline
app.UseHttpsRedirection();

// Baseline security headers — cheap to add, closes off a whole class of browser-side attacks.
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

app.UseCors("frontend");
app.UseRateLimiter();

app.UseAuthentication();
app.UseMiddleware<RequirePasswordCurrentMiddleware>();
app.UseAuthorization();

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<NexoraDbContext>();
    await db.Database.MigrateAsync();
    await Nexora.Api.Seed.DevSeeder.SeedIfEmptyAsync(app.Services);
    await Nexora.Modules.Identity.Seed.RolePermissionSync.RunAsync(app.Services);
    await Nexora.Modules.HR.Seed.JobTitleSync.RunAsync(app.Services);
    await Nexora.Modules.Finance.Seed.AccountSync.RunAsync(app.Services);
    await Nexora.Modules.Identity.Seed.DefaultDataScopeSync.RunAsync(app.Services);
}

app.Run();
