using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiCurrencySupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BaseCurrencyCode",
                table: "Tenants",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "INR");

            // Existing journal lines predate multi-currency entirely — they were always
            // posted 1:1 in whatever the account's currency is, so backfilling rate=1 keeps
            // every historical entry's base-equivalent identical to its native amount.
            migrationBuilder.AddColumn<decimal>(
                name: "ExchangeRateToBase",
                table: "JournalLines",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 1m);

            // Existing accounts predate multi-currency too — they were always the tenant's
            // base currency by construction, so backfilling "INR" (today's only real base
            // currency in use) keeps every historical balance meaning exactly what it already did.
            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "Accounts",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "INR");

            migrationBuilder.CreateTable(
                name: "ExchangeRates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    RateToBase = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeRates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeRates_TenantId_CurrencyCode_EffectiveDate",
                table: "ExchangeRates",
                columns: new[] { "TenantId", "CurrencyCode", "EffectiveDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeRates_TenantId_IsDeleted",
                table: "ExchangeRates",
                columns: new[] { "TenantId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExchangeRates");

            migrationBuilder.DropColumn(
                name: "BaseCurrencyCode",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "ExchangeRateToBase",
                table: "JournalLines");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "Accounts");
        }
    }
}
