CREATE TABLE `feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tester_name` varchar(128),
	`page` varchar(128),
	`type` enum('bug','suggestion','question','other') NOT NULL DEFAULT 'other',
	`message` text NOT NULL,
	`source` enum('button','ruben') NOT NULL DEFAULT 'button',
	`resolved` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
