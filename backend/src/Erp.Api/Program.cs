using System.Text;
using System.Threading.RateLimiting;
using Erp.Api.Authorization;
using Erp.Domain.Identity;
using Erp.Infrastructure.Persistence;
using Erp.Infrastructure.Tenancy;
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
builder.Services.AddExceptionHandler<Erp.Api.Middleware.GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// --- Persistence & multi-tenancy -------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantContext, JwtTenantContext>();
builder.Services.AddScoped<Erp.Infrastructure.Workflow.IApprovalWorkflowService, Erp.Infrastructure.Workflow.ApprovalWorkflowService>();
builder.Services.AddSingleton<Erp.Api.Services.EmployeeDocumentStorage>();
builder.Services.AddScoped<Erp.Infrastructure.Authorization.DataScopeService>();
builder.Services.AddDbContext<ErpDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

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
    .AddEntityFrameworkStores<ErpDbContext>()
    .AddDefaultTokenProviders(); // required for password-reset tokens (UsersController.ResetPassword)

// --- AuthN / AuthZ -----------------------------------------------------------------
var jwtKey = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey is not configured.");

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
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
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
app.UseMiddleware<Erp.Api.Authorization.RequirePasswordCurrentMiddleware>();
app.UseAuthorization();

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
    await db.Database.MigrateAsync();
    await Erp.Api.Seed.DevSeeder.SeedIfEmptyAsync(app.Services);
    await Erp.Api.Seed.RolePermissionSync.RunAsync(app.Services);
    await Erp.Api.Seed.JobTitleSync.RunAsync(app.Services);
    await Erp.Api.Seed.AccountSync.RunAsync(app.Services);
}

app.Run();
