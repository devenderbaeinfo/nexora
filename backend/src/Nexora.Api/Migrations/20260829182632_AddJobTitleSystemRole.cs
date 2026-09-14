using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTitleSystemRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing job titles predate this concept entirely — default them to the
            // least-privileged role (Employee) rather than leaving them blank, which would
            // throw the moment RoleTemplates.PermissionsFor tried to resolve one. HR can
            // repoint any of these (e.g. "SENIOR MANAGER" -> Manager) via PATCH afterward.
            migrationBuilder.AddColumn<string>(
                name: "SystemRole",
                table: "JobTitles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "Employee");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SystemRole",
                table: "JobTitles");
        }
    }
}
