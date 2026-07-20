CREATE TABLE `customer_discount_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`discount_pct` decimal(8,4) NOT NULL,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_discount_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`tier` int NOT NULL DEFAULT 3,
	`sales_2025_26` decimal(14,2),
	`import_deposit_exception` int DEFAULT 0,
	`notes` text,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dealer_margin_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` enum('global','category','vendor','sku') NOT NULL,
	`scope_value` varchar(256),
	`import_margin_pct` decimal(8,4),
	`domestic_margin_pct` decimal(8,4),
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealer_margin_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dealer_price_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`import_list_override` decimal(10,2),
	`domestic_list_override` decimal(10,2),
	`import_net_override` decimal(10,2),
	`domestic_net_override` decimal(10,2),
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealer_price_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_config_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `pricing_locks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` enum('supply','buy') NOT NULL,
	`locked` int NOT NULL DEFAULT 0,
	`password_hash` varchar(256),
	`locked_at` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_locks_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_locks_scope_unique` UNIQUE(`scope`)
);
--> statement-breakpoint
CREATE TABLE `sku_discount_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`discount_pct` decimal(8,4) NOT NULL,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sku_discount_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tier_discounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tier` int NOT NULL,
	`discount_pct` decimal(8,4) NOT NULL,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tier_discounts_id` PRIMARY KEY(`id`)
);
