CREATE TABLE `freight_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`value` decimal(12,6) NOT NULL,
	`label` varchar(128) NOT NULL,
	`unit` varchar(32),
	`formula_note` text,
	`source_note` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `freight_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `freight_config_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `hts_tariff_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hts_code` varchar(32) NOT NULL,
	`description` varchar(255),
	`base_duty_pct` decimal(8,4) DEFAULT '0',
	`sec301_pct` decimal(8,4) DEFAULT '0',
	`sec232_pct` decimal(8,4) DEFAULT '0',
	`sec122_pct` decimal(8,4) DEFAULT '0',
	`source_url` varchar(512),
	`notes` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hts_tariff_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `hts_tariff_rates_hts_code_unique` UNIQUE(`hts_code`)
);
--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(128) NOT NULL,
	`scope` enum('supply','buy') NOT NULL,
	`snapshot_data` text NOT NULL,
	`sku_count` int DEFAULT 0,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_snapshots_id` PRIMARY KEY(`id`)
);
