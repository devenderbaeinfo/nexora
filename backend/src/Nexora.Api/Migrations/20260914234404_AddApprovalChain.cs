using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalChain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ApprovalChainDefinitionId",
                table: "LeaveRequests",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ApprovalChainDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ScopeType = table.Column<int>(type: "int", nullable: false),
                    ScopeKey = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalChainDefinitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ApprovalChainStages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChainDefinitionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StageOrder = table.Column<int>(type: "int", nullable: false),
                    StageName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsHrStage = table.Column<bool>(type: "bit", nullable: false),
                    ResolutionType = table.Column<int>(type: "int", nullable: false),
                    ApproverEmployeeId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ApproverRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalChainStages", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalChainDefinitions_TenantId_EntityType_ScopeType_ScopeKey",
                table: "ApprovalChainDefinitions",
                columns: new[] { "TenantId", "EntityType", "ScopeType", "ScopeKey" });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalChainDefinitions_TenantId_IsDeleted",
                table: "ApprovalChainDefinitions",
                columns: new[] { "TenantId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalChainStages_TenantId_ChainDefinitionId_StageOrder",
                table: "ApprovalChainStages",
                columns: new[] { "TenantId", "ChainDefinitionId", "StageOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalChainStages_TenantId_IsDeleted",
                table: "ApprovalChainStages",
                columns: new[] { "TenantId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApprovalChainDefinitions");

            migrationBuilder.DropTable(
                name: "ApprovalChainStages");

            migrationBuilder.DropColumn(
                name: "ApprovalChainDefinitionId",
                table: "LeaveRequests");
        }
    }
}
