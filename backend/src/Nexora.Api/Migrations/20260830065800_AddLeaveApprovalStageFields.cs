using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaveApprovalStageFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "HrActedAtUtc",
                table: "LeaveRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "HrActedByUserId",
                table: "LeaveRequests",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HrApprovalStatus",
                table: "LeaveRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "HrComment",
                table: "LeaveRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ManagerActedAtUtc",
                table: "LeaveRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ManagerActedByUserId",
                table: "LeaveRequests",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ManagerApprovalStatus",
                table: "LeaveRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ManagerComment",
                table: "LeaveRequests",
                type: "nvarchar(max)",
                nullable: true);

            // Backfill the two new stage-status columns for rows that predate them, from each
            // row's existing Status (0=PendingManagerApproval, 1=PendingHrApproval, 2=Approved,
            // 3=RejectedByManager, 4=Cancelled) — the AddColumn default of 0 (NotRequired) is
            // only correct for the PendingManagerApproval and Cancelled/RejectedByManager cases.
            migrationBuilder.Sql(@"
                UPDATE [LeaveRequests] SET [ManagerApprovalStatus] = 1 WHERE [Status] = 0;   -- Pending
                UPDATE [LeaveRequests] SET [ManagerApprovalStatus] = 2, [HrApprovalStatus] = 1 WHERE [Status] = 1;  -- Approved, Pending
                UPDATE [LeaveRequests] SET [ManagerApprovalStatus] = 2, [HrApprovalStatus] = 2 WHERE [Status] = 2;  -- Approved, Approved
                UPDATE [LeaveRequests] SET [ManagerApprovalStatus] = 3 WHERE [Status] = 3;   -- Rejected
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HrActedAtUtc",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "HrActedByUserId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "HrApprovalStatus",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "HrComment",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "ManagerActedAtUtc",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "ManagerActedByUserId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "ManagerApprovalStatus",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "ManagerComment",
                table: "LeaveRequests");
        }
    }
}
