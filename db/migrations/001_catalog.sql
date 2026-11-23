IF DB_ID(N'fasol') IS NULL EXEC(N'CREATE DATABASE [fasol]');
GO
USE [fasol];
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock @Resource = N'fasol.catalog', @LockMode = 'Exclusive', @LockTimeout = 15000;
IF @lockResult < 0 THROW 50001, 'Could not acquire catalog migration lock.', 1;

IF OBJECT_ID(N'dbo.category', N'U') IS NULL
    CREATE TABLE dbo.category (ID int IDENTITY PRIMARY KEY, [name] nvarchar(30) NOT NULL UNIQUE);

IF OBJECT_ID(N'dbo.product', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product (
        ID int IDENTITY PRIMARY KEY,
        [name] nvarchar(30) NOT NULL,
        CategoryID int NOT NULL CONSTRAINT FK_product_category REFERENCES dbo.category(ID),
        ProductDate date NULL,
        ImageData varbinary(max) NULL,
        ImageType varchar(20) NULL
    );
    CREATE TABLE #NewCatalog (flag bit NOT NULL);
END;
GO

INSERT INTO dbo.category ([name])
SELECT seed.[name]
FROM (VALUES (N'Фрукты'), (N'Овощи'), (N'Молочные продукты'), (N'Крупы и бобовые'), (N'Хлеб и выпечка'), (N'Напитки')) AS seed ([name])
WHERE NOT EXISTS (SELECT 1 FROM dbo.category AS currentCategory WHERE currentCategory.[name] = seed.[name]);

IF COL_LENGTH(N'dbo.product', N'cat_ID') IS NOT NULL
BEGIN
    EXEC(N'
        INSERT INTO dbo.category ([name])
        SELECT DISTINCT product.cat_ID FROM dbo.product AS product
        WHERE NOT EXISTS (SELECT 1 FROM dbo.category AS category WHERE category.[name] = product.cat_ID);
        ALTER TABLE dbo.product ADD CategoryID int NULL;');
    EXEC(N'
        UPDATE product SET CategoryID = category.ID
        FROM dbo.product AS product JOIN dbo.category AS category ON category.[name] = product.cat_ID;
        ALTER TABLE dbo.product ALTER COLUMN CategoryID int NOT NULL;
        ALTER TABLE dbo.product ADD CONSTRAINT FK_product_category FOREIGN KEY (CategoryID) REFERENCES dbo.category(ID);
        ALTER TABLE dbo.product DROP COLUMN cat_ID;');
END;

IF COL_LENGTH(N'dbo.product', N'ProductDate') IS NULL
    ALTER TABLE dbo.product ADD ProductDate date NULL, ImageData varbinary(max) NULL, ImageType varchar(20) NULL;
GO

IF OBJECT_ID(N'tempdb..#NewCatalog') IS NOT NULL
BEGIN
:r /db/seed/001_products.sql
END;

IF OBJECT_ID(N'dbo.chart', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.chart ([Month] int NOT NULL PRIMARY KEY CHECK ([Month] BETWEEN 1 AND 12), Proceed decimal(8,2) NOT NULL);
    INSERT INTO dbo.chart ([Month], Proceed) VALUES
        (1, -32), (2, -14), (3, 8), (4, 24), (5, 18), (6, 46),
        (7, 63), (8, 54), (9, 31), (10, 48), (11, 72), (12, 94);
END;

:r /db/migrations/002_product_photos.sql

COMMIT TRANSACTION;
