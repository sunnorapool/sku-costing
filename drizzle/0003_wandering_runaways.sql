CREATE TABLE `channel_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`channel_id` int NOT NULL,
	`price` decimal(10,2),
	`floor_price` decimal(10,2),
	`ceiling_price` decimal(10,2),
	`target_margin_pct` decimal(8,4),
	`margin_pct` decimal(8,4),
	`margin_amt` decimal(10,2),
	`competitor_price` decimal(10,2),
	`competitor_url` text,
	`notes` text,
	`effective_date` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channel_prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`type` enum('online','wholesale') NOT NULL,
	`sort_order` int DEFAULT 0,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`)
);
