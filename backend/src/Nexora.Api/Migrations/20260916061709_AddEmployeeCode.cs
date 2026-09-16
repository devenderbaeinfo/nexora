using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmployeeCode",
                table: "Employees",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            // Backfill existing rows before the unique index below, since every one currently
            // has the same "" default — same numbering scheme UsersController.Create uses
            // going forward: sequential per tenant, prefixed with the tenant's slug.
            migrationBuilder.Sql(@"
                WITH Numbered AS (
                    SELECT e.Id,
                           UPPER(COALESCE(t.Slug, CONVERT(varchar(36), e.TenantId))) + '-' +
                               RIGHT('0000' + CAST(ROW_NUMBER() OVER (PARTITION BY e.TenantId ORDER BY e.CreatedAtUtc, e.Id) AS varchar(10)), 4) AS Code
                    FROM Employees e
                    LEFT JOIN Tenants t ON t.Id = e.TenantId
                )
                UPDATE Employees
                SET EmployeeCode = Numbered.Code
                FROM Employees
                JOIN Numbered ON Numbered.Id = Employees.Id;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_TenantId_EmployeeCode",
                table: "Employees",
                columns: new[] { "TenantId", "EmployeeCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_TenantId_EmployeeCode",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "EmployeeCode",
                table: "Employees");
        }
    }
}
