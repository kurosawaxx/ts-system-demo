<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class TestEnvironmentIsolationTest extends TestCase
{
    /**
     * docker-compose.ymlはbackendコンテナのOS環境変数としてDB_CONNECTION=mysql等を設定している。
     * phpunit.xmlのforce属性が効いていないと、テストが実DBに対してmigrate:freshを実行し
     * 開発用データを消してしまう(過去に実際に発生した事故の再発防止)。
     */
    public function test_phpunit_env_overrides_container_level_db_connection(): void
    {
        $this->assertSame('sqlite', getenv('DB_CONNECTION'));
        $this->assertSame(':memory:', getenv('DB_DATABASE'));
        $this->assertSame('testing', getenv('APP_ENV'));
    }
}
