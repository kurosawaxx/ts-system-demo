# ベースイメージはタグと digest で固定する。タグだけだと Docker Hub 側の更新で
# 中身が差し替わり、デプロイ時に前触れなく全レイヤーの再ビルドが走る
# （2026-09-30 の stg デプロイ失敗の引き金）。更新は dependabot の PR で受ける。
FROM php:8.3.35-fpm@sha256:e436b5b6ce4a4e632f97a66ea0ea14c5d001e229e2adc5c8ed2f7b5b5fe5c989

RUN apt-get update && apt-get install -y \
    curl \
    libpng-dev \
    libzip-dev \
    libonig-dev \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-configure gd --with-freetype --with-jpeg && \
    docker-php-ext-install \
        pdo_mysql \
        mbstring \
        zip \
        gd \
        opcache

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

RUN chown -R www-data:www-data /var/www/html

EXPOSE 8015

# ソースは bind mount されるため、vendor はイメージに焼き込まず起動時に用意する。
# symfony 8.0 系は php >=8.4 を要求するが、実際に使う 8.4 の組み込み関数は
# bootstrap/php_compat.php で polyfill しているため PHP 8.3 で動作する。
CMD ["sh", "-c", "composer install --no-interaction --prefer-dist --ignore-platform-reqs && php artisan serve --host=0.0.0.0 --port=8015"]
