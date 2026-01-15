import winston from "winston";
import "winston-daily-rotate-file";

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
    level: "info",
    format: combine(timestamp(), myFormat),
    transports: [
        new winston.transports.Console({
            format: combine(colorize(), timestamp(), myFormat),
        }),
        new winston.transports.DailyRotateFile({
            filename: "logs/%DATE%-application.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "14d",
        }),
    ],
});

export default logger;
