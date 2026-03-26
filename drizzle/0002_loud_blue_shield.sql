CREATE TABLE `global_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version_name` varchar(256),
	`user_id` int,
	`user_name` varchar(256),
	`change_type` enum('manual_edit','ai_prompt','bulk_import','restore') NOT NULL DEFAULT 'manual_edit',
	`change_description` text,
	`prompt_text` text,
	`affected_count` int DEFAULT 0,
	`snapshot_data` json,
	`affected_sku_ids` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `global_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `srp_margin` decimal(10,2);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `tariff_pct` decimal(8,4);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `tariff_amt` decimal(10,2);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `duty_pct` decimal(8,4);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `duty_amt` decimal(10,2);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `freight` decimal(10,2);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `freight_alt` decimal(10,2);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `load_pct` decimal(8,4);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `bd_license_fee_pct` decimal(8,4);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `asia_margin_pct` decimal(8,4);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `bd_fee` decimal(10,2);--> statement-breakpoint
ALTER TABLE `sku_pricing` ADD `notes` text;