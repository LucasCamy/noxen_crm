using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Noxen.Crm.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase5ClientProfileAndLeadNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "clients",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ContractEnd",
                table: "clients",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ContractStart",
                table: "clients",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContractedServices",
                table: "clients",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "clients",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Readjustment",
                table: "clients",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "client_accesses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Account = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AccessType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PasswordLocation = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    GrantedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_accesses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_client_accesses_clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "client_profiles",
                columns: table => new
                {
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Website = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Instagram = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Facebook = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    TikTok = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    WhatTheySell = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IdealCustomer = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Differentiators = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Competitors = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Seasonality = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    MainGoal = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Needs = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ToneOfVoice = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ContentPillars = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    WhatWorked = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AdBudget = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_profiles", x => x.ClientId);
                    table.ForeignKey(
                        name: "FK_client_profiles_clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "lead_notes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LeadId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lead_notes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_lead_notes_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_lead_notes_leads_LeadId",
                        column: x => x.LeadId,
                        principalTable: "leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_client_accesses_ClientId",
                table: "client_accesses",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_lead_notes_CreatedById",
                table: "lead_notes",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_lead_notes_LeadId_CreatedAt",
                table: "lead_notes",
                columns: new[] { "LeadId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "client_accesses");

            migrationBuilder.DropTable(
                name: "client_profiles");

            migrationBuilder.DropTable(
                name: "lead_notes");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "ContractEnd",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "ContractStart",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "ContractedServices",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "Readjustment",
                table: "clients");
        }
    }
}
