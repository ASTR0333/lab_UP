IF OBJECT_ID(N'dbo.catalog_migration', N'U') IS NULL
    CREATE TABLE dbo.catalog_migration (Version int NOT NULL PRIMARY KEY);

IF NOT EXISTS (SELECT 1 FROM dbo.catalog_migration WHERE Version = 2)
BEGIN
    DECLARE demoPhotos CURSOR LOCAL FAST_FORWARD FOR
        SELECT [ProductName], [CategoryName], [Filename]
        FROM (VALUES
            (N'Яблоко', N'Фрукты', N'apple.jpg'),
            (N'Груша', N'Фрукты', N'pear.jpg'),
            (N'Банан', N'Фрукты', N'banana.jpg'),
            (N'Картофель', N'Овощи', N'potato.jpg'),
            (N'Огурец', N'Овощи', N'cucumber.jpg'),
            (N'Морковь', N'Овощи', N'carrot.jpg'),
            (N'Молоко 3,2%', N'Молочные продукты', N'milk.jpg'),
            (N'Кефир 2,5%', N'Молочные продукты', N'kefir.jpg'),
            (N'Творог 5%', N'Молочные продукты', N'cottage-cheese.jpg'),
            (N'Рис длиннозёрный', N'Крупы и бобовые', N'rice.jpg'),
            (N'Гречневая крупа', N'Крупы и бобовые', N'buckwheat.jpg'),
            (N'Фасоль красная', N'Крупы и бобовые', N'red-beans.jpg'),
            (N'Батон нарезной', N'Хлеб и выпечка', N'sliced-loaf.jpg'),
            (N'Хлеб ржаной', N'Хлеб и выпечка', N'rye-bread.jpg'),
            (N'Булочка с маком', N'Хлеб и выпечка', N'poppy-roll.jpg'),
            (N'Сок яблочный', N'Напитки', N'apple-juice.jpg'),
            (N'Морс клюквенный', N'Напитки', N'cranberry-drink.jpg'),
            (N'Вода питьевая', N'Напитки', N'drinking-water.jpg')
        ) AS photos ([ProductName], [CategoryName], [Filename]);

    DECLARE @productName nvarchar(30), @categoryName nvarchar(30), @filename nvarchar(64), @photoSql nvarchar(max);
    OPEN demoPhotos;
    FETCH NEXT FROM demoPhotos INTO @productName, @categoryName, @filename;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @photoSql = N'
            UPDATE product SET ImageData = photo.BulkColumn, ImageType = ''image/jpeg''
            FROM dbo.product AS product
            CROSS JOIN OPENROWSET(BULK ' + QUOTENAME(N'/photos/' + @filename, '''') + N', SINGLE_BLOB) AS photo
            WHERE product.ImageData IS NULL AND product.ID = (
                SELECT MIN(p.ID) FROM dbo.product AS p JOIN dbo.category AS c ON c.ID = p.CategoryID
                WHERE p.[name] = @productName AND c.[name] = @categoryName
            );';
        EXEC sys.sp_executesql @photoSql, N'@productName nvarchar(30), @categoryName nvarchar(30)', @productName, @categoryName;
        FETCH NEXT FROM demoPhotos INTO @productName, @categoryName, @filename;
    END;
    CLOSE demoPhotos;
    DEALLOCATE demoPhotos;

    INSERT INTO dbo.catalog_migration (Version) VALUES (2);
END;
