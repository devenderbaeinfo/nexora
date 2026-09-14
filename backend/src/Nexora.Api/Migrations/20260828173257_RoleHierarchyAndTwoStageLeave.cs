using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class RoleHierarchyAndTwoStageLeave : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "DecisionNote",
                table: "LeaveRequests",
                newName: "ManagerNote");

            migrationBuilder.RenameColumn(
                name: "DecidedByUserId",
                table: "LeaveRequests",
                newName: "ManagerDecidedByUserId");

            migrationBuilder.RenameColumn(
                name: "DecidedAtUtc",
                table: "LeaveRequests",
                newName: "ManagerDecidedAtUtc");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "HrDecidedAtUtc",
                table: "LeaveRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "HrDecidedByUserId",
                table: "LeaveRequests",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HrNote",
                table: "LeaveRequests",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HrDecidedAtUtc",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "HrDecidedByUserId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "HrNote",
                table: "LeaveRequests");

            migrationBuilder.RenameColumn(
                name: "ManagerNote",
                table: "LeaveRequests",
                newName: "DecisionNote");

            migrationBuilder.RenameColumn(
                name: "ManagerDecidedByUserId",
                table: "LeaveRequests",
                newName: "DecidedByUserId");

            migrationBuilder.RenameColumn(
                name: "ManagerDecidedAtUtc",
                table: "LeaveRequests",
                newName: "DecidedAtUtc");
        }
    }
}
