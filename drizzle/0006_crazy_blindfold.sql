ALTER TABLE `skus` ADD `fob_2027_price` decimal(10,4);--> statement-breakpoint
ALTER TABLE `skus` ADD `fob_2027_status` enum('confirmed','placeholder','missing');--> statement-breakpoint
ALTER TABLE `skus` ADD `fob_2027_source` varchar(256);