using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceDesignationWithJobTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Keep the old free-text values around under a temp name long enough to backfill
            // JobTitles/JobTitleId from them below — dropping them up front (as the raw EF diff
            // would) would lose every existing employee's title with no way to recover it.
            migrationBuilder.RenameColumn(
                name: "Designation", table: "Employees", newName: "DesignationOld");
            migrationBuilder.RenameColumn(
                name: "Designation", table: "EmployeeAssignmentHistories", newName: "DesignationOld");

            migrationBuilder.AddColumn<Guid>(
                name: "JobTitleId",
                table: "Employees",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "JobTitleId",
                table: "EmployeeAssignmentHistories",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "JobTitles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JobTitles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_JobTitles_TenantId_IsDeleted",
                table: "JobTitles",
                columns: new[] { "TenantId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_JobTitles_TenantId_Name",
                table: "JobTitles",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            // Backfill: one JobTitle row per distinct (TenantId, old free-text value) that was
            // actually in use, then point every Employee/EmployeeAssignmentHistory row at it.
            migrationBuilder.Sql(@"
                INSERT INTO JobTitles (Id, TenantId, Name, CreatedAtUtc, IsDeleted)
                SELECT NEWID(), TenantId, DesignationOld, SYSDATETIMEOFFSET(), 0
                FROM (SELECT DISTINCT TenantId, DesignationOld FROM Employees WHERE DesignationOld IS NOT NULL AND DesignationOld <> '') AS d;

                UPDATE e
                SET e.JobTitleId = jt.Id
                FROM Employees e
                JOIN JobTitles jt ON jt.TenantId = e.TenantId AND jt.Name = e.DesignationOld;

                INSERT INTO JobTitles (Id, TenantId, Name, CreatedAtUtc, IsDeleted)
                SELECT NEWID(), h.TenantId, h.DesignationOld, SYSDATETIMEOFFSET(), 0
                FROM (SELECT DISTINCT TenantId, DesignationOld FROM EmployeeAssignmentHistories WHERE DesignationOld IS NOT NULL AND DesignationOld <> '') AS h
                WHERE NOT EXISTS (SELECT 1 FROM JobTitles jt WHERE jt.TenantId = h.TenantId AND jt.Name = h.DesignationOld);

                UPDATE h
                SET h.JobTitleId = jt.Id
                FROM EmployeeAssignmentHistories h
                JOIN JobTitles jt ON jt.TenantId = h.TenantId AND jt.Name = h.DesignationOld;
            ");

            migrationBuilder.DropColumn(name: "DesignationOld", table: "Employees");
            migrationBuilder.DropColumn(name: "DesignationOld", table: "EmployeeAssignmentHistories");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "JobTitles");

            migrationBuilder.DropColumn(
                name: "JobTitleId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "JobTitleId",
                table: "EmployeeAssignmentHistories");

            migrationBuilder.AddColumn<string>(
                name: "Designation",
                table: "Employees",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Designation",
                table: "EmployeeAssignmentHistories",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }
    }
}
