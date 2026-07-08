CREATE TABLE `carton_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`carton_num` decimal(6,1),
	`carton_label` varchar(256),
	`component_sku` varchar(64),
	`qty_per_parent` decimal(8,2),
	`component_sellable` varchar(8),
	`pack_rule_status` varchar(128),
	`carton_l` decimal(8,2),
	`carton_w` decimal(8,2),
	`carton_h` decimal(8,2),
	`gross_wt_kg` decimal(8,3),
	`net_wt_kg` decimal(8,3),
	`pcs_per_carton` decimal(8,2),
	`gross_wt_per_unit` decimal(8,3),
	`net_wt_per_unit` decimal(8,3),
	`packing_type` varchar(64),
	`verified_by` varchar(256),
	`verified_at` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carton_details_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `skus` ADD `supplier` varchar(128);--> statement-breakpoint
ALTER TABLE `skus` ADD `hts_code` varchar(32);--> statement-breakpoint
ALTER TABLE `skus` ADD `source_status` varchar(128);--> statement-breakpoint
ALTER TABLE `skus` ADD `is_bd` varchar(8);--> statement-breakpoint
ALTER TABLE `skus` ADD `sales_qty_2024_ytd` decimal(14,2);--> statement-breakpoint
ALTER TABLE `skus` ADD `avg_price_2024_ytd` decimal(10,4);--> statement-breakpoint
ALTER TABLE `skus` ADD `sales_amt_2024_ytd` decimal(14,2);--> statement-breakpoint
ALTER TABLE `skus` ADD `carton_l` decimal(8,2);--> statement-breakpoint
ALTER TABLE `skus` ADD `carton_w` decimal(8,2);--> statement-breakpoint
ALTER TABLE `skus` ADD `carton_h` decimal(8,2);--> statement-breakpoint
ALTER TABLE `skus` ADD `gross_wt_kg` decimal(8,3);--> statement-breakpoint
ALTER TABLE `skus` ADD `net_wt_kg` decimal(8,3);--> statement-breakpoint
ALTER TABLE `skus` ADD `pcs_per_carton` decimal(8,2);--> statement-breakpoint
ALTER TABLE `skus` ADD `gross_wt_per_unit` decimal(8,3);--> statement-breakpoint
ALTER TABLE `skus` ADD `net_wt_per_unit` decimal(8,3);--> statement-breakpoint
ALTER TABLE `skus` ADD `packing_type` varchar(64);--> statement-breakpoint
ALTER TABLE `skus` ADD `carton_count` int;