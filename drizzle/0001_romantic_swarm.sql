CREATE TABLE `sku_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`srp_2023` decimal(10,2),
	`srp_2024` decimal(10,2),
	`map` decimal(10,2),
	`comps_2024` decimal(10,2),
	`srp_2024_amzn` decimal(10,2),
	`wholesale_pool_city` decimal(10,2),
	`bd_wholesale_margin_pct` decimal(8,4),
	`fob_26_costing` decimal(10,2),
	`factory_cost` decimal(10,2),
	`pptg_25_wholesale_price` decimal(10,2),
	`bd_wholesale_retail_24` decimal(10,2),
	`bd_wholesale_retail_25` decimal(10,2),
	`adjusted` decimal(10,2),
	`inc_24_25_pct` decimal(8,4),
	`bd_margin` decimal(10,2),
	`bd_margin_pct` decimal(8,4),
	`landed_cost` decimal(10,2),
	`landed_plus_bd_fees` decimal(10,2),
	`margin` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sku_pricing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sku_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`user_id` int,
	`change_type` enum('create','update','delete','ai_prompt','import','revert') NOT NULL,
	`change_description` text,
	`prompt_text` text,
	`previous_data` json,
	`new_data` json,
	`affected_sku_ids` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sku_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(64) NOT NULL,
	`description` text,
	`product_group` varchar(128),
	`var1` varchar(128),
	`var2` varchar(128),
	`status` enum('active','done','new_model','missing','discontinued') NOT NULL DEFAULT 'active',
	`sort_order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skus_id` PRIMARY KEY(`id`),
	CONSTRAINT `skus_sku_unique` UNIQUE(`sku`)
);
