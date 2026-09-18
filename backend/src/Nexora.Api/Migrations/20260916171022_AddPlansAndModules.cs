using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlansAndModules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PlanId",
                table: "Tenants",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlanModules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModuleKey = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanModules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Plans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    IsCustomPricing = table.Column<bool>(type: "bit", nullable: false),
                    MaxUsers = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenantModules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModuleKey = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantModules", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlanModules_PlanId_ModuleKey",
                table: "PlanModules",
                columns: new[] { "PlanId", "ModuleKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantModules_TenantId_ModuleKey",
                table: "TenantModules",
                columns: new[] { "TenantId", "ModuleKey" },
                unique: true);

            // Seed the 3 fixed tiers that used to be frontend mock data (adminMockData.ts) —
            // fixed GUIDs so this seed is idempotent/deterministic across environments. Super
            // admins can edit or delete these afterward via PlanController; nothing here is special-cased.
            var seededAt = new DateTimeOffset(2026, 9, 16, 0, 0, 0, TimeSpan.Zero);
            var starterId = new Guid("11111111-1111-1111-1111-111111111111");
            var professionalId = new Guid("22222222-2222-2222-2222-222222222222");
            var enterpriseId = new Guid("33333333-3333-3333-3333-333333333333");

            migrationBuilder.InsertData(
                table: "Plans",
                columns: new[] { "Id", "Name", "MonthlyPrice", "IsCustomPricing", "MaxUsers", "Status", "CreatedAtUtc", "UpdatedAtUtc", "IsDeleted" },
                values: new object[,]
                {
                    { starterId, "Starter", 9999m, false, 50, 0, seededAt, null, false },
                    { professionalId, "Professional", 24999m, false, 250, 0, seededAt, null, false },
                    { enterpriseId, "Enterprise", null, true, null, 0, seededAt, null, false },
                });

            migrationBuilder.InsertData(
                table: "PlanModules",
                columns: new[] { "Id", "PlanId", "ModuleKey" },
                values: new object[,]
                {
                    { Guid.NewGuid(), starterId, "people" },
                    { Guid.NewGuid(), starterId, "timecard" },
                    { Guid.NewGuid(), starterId, "leave" },

                    { Guid.NewGuid(), professionalId, "people" },
                    { Guid.NewGuid(), professionalId, "timecard" },
                    { Guid.NewGuid(), professionalId, "leave" },
                    { Guid.NewGuid(), professionalId, "reimbursement" },
                    { Guid.NewGuid(), professionalId, "projects" },

                    { Guid.NewGuid(), enterpriseId, "people" },
                    { Guid.NewGuid(), enterpriseId, "timecard" },
                    { Guid.NewGuid(), enterpriseId, "leave" },
                    { Guid.NewGuid(), enterpriseId, "reimbursement" },
                    { Guid.NewGuid(), enterpriseId, "projects" },
                    { Guid.NewGuid(), enterpriseId, "accounting" },
                    { Guid.NewGuid(), enterpriseId, "reports" },
                });

            // Grandfather every tenant that already existed before module gating shipped —
            // they had unrestricted access before this migration, so they keep it (Custom,
            // PlanId stays null) rather than suddenly losing every module the moment this runs.
            // Only tenants created after this point actually need a plan/module choice.
            migrationBuilder.Sql(@"
                INSERT INTO TenantModules (Id, TenantId, ModuleKey)
                SELECT NEWID(), t.Id, m.ModuleKey
                FROM Tenants t
                CROSS JOIN (VALUES ('people'),('timecard'),('leave'),('reimbursement'),('projects'),('accounting'),('payroll'),('reports')) AS m(ModuleKey)
                WHERE t.Slug <> 'platform';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlanModules");

            migrationBuilder.DropTable(
                name: "Plans");

            migrationBuilder.DropTable(
                name: "TenantModules");

            migrationBuilder.DropColumn(
                name: "PlanId",
                table: "Tenants");
        }
    }
}
