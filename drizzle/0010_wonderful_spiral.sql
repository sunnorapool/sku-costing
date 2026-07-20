CREATE TABLE `customer_sku_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`sku_id` int NOT NULL,
	`sku_code` varchar(64) NOT NULL,
	`total_qty` decimal(14,2),
	`total_sales_amt` decimal(14,2),
	`avg_realized_price` decimal(10,4),
	`period_label` varchar(64),
	`source_db` varchar(128) DEFAULT 'chuck_sqlite_2026-07-17',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_sku_sales_id` PRIMARY KEY(`id`)
);
