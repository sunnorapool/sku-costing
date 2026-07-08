CREATE TABLE `channel_price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`channel_id` int NOT NULL,
	`old_price` decimal(10,2),
	`new_price` decimal(10,2),
	`old_margin_pct` decimal(8,4),
	`new_margin_pct` decimal(8,4),
	`old_floor_price` decimal(10,2),
	`new_floor_price` decimal(10,2),
	`old_ceiling_price` decimal(10,2),
	`new_ceiling_price` decimal(10,2),
	`change_source` varchar(64) DEFAULT 'manual',
	`notes` text,
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_price_history_id` PRIMARY KEY(`id`)
);
