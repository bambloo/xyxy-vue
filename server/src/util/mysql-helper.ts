import { createConnection, createPool, Pool, Query } from 'mysql2/promise'
import { MYSQL_HOST, MYSQL_PORT, MYSQL_PSWD, MYSQL_USER } from '../config'

let global_connection: Pool

export const database_sql = 'create database if not exists cmdata charset utf8mb4'
export const table_cols =
  "`a` varchar(16) NOT NULL,\
`b` varchar(45) NOT NULL,\
`c` int NOT NULL,\
`d` varchar(16) NOT NULL,\
`e` int NOT NULL,\
`f` varchar(8) NOT NULL,\
`g` varchar(8) NOT NULL,\
`h` varchar(64) NOT NULL,\
`i` varchar(128) NOT NULL,\
`j` int NOT NULL,\
`k` varchar(64) NOT NULL,\
`l` varchar(128) NOT NULL,\
`m` varchar(64) NOT NULL,\
`n` varchar(32) NOT NULL,\
`o` int NOT NULL,\
`p` varchar(64) NOT NULL,\
`q` varchar(32) NOT NULL,\
`r` int NOT NULL,\
`s` varchar(64) NOT NULL,\
`t` varchar(16) NOT NULL,\
`u` varchar(16) NOT NULL,\
`v` int NOT NULL,\
`w` int DEFAULT '0',\
`x` tinyint NOT NULL,\
`y` tinyint NOT NULL,\
`z` varchar(32) NOT NULL,\
`aa` varchar(32) NOT NULL,\
`ab` varchar(32) NOT NULL,\
`ac` varchar(32) NOT NULL,\
`ad` varchar(64) DEFAULT NULL,\
`ae` varchar(64) DEFAULT NULL,\
`af` int DEFAULT '0',\
`ag` int NOT NULL DEFAULT '0',\
`ah` int NOT NULL DEFAULT '1',\
`ai` varchar(45) DEFAULT NULL,\
`aj` varchar(45) DEFAULT NULL,\
`ak` varchar(45) DEFAULT NULL,\
`al` varchar(45) DEFAULT NULL,\
`am` varchar(45) DEFAULT NULL,\
`an` varchar(45) DEFAULT NULL,\
`ao` varchar(45) DEFAULT NULL,\
`ap` varchar(45) DEFAULT NULL,\
`aq` varchar(45) DEFAULT NULL,\
`ar` varchar(45) DEFAULT NULL,\
`as` int DEFAULT '0',\
`at` varchar(45) DEFAULT '',\
`au` int DEFAULT '1',\
PRIMARY KEY (`h`)"

const table_tut_sql =
  "CREATE TABLE IF NOT EXISTS `tut`\
  (\
  `state` int DEFAULT '0',\
  `ctime` timestamp DEFAULT CURRENT_TIMESTAMP,\
  `mtime` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\
  `upres` varchar(64)," +
  table_cols +
  ')'
const table_ect_sql =
  'CREATE TABLE IF NOT EXISTS `ect`\
(\
`a` VARCHAR(16) NOT NULL,\
`b` VARCHAR(16) NOT NULL,\
`c` VARCHAR(48) NOT NULL,\
`d` VARCHAR(8) NOT NULL,\
PRIMARY KEY(`a`)\
)'

const table_drop_spt_sql = 'drop table if exists `spt`'
const table_spt_sql =
  "CREATE TABLE IF NOT EXISTS `spt`\
(\
`a` VARCHAR(64),\
`b` VARCHAR(64),\
`c` VARCHAR(64) NOT NULL,\
`d` VARCHAR(64),\
`e` VARCHAR(64),\
`f` VARCHAR(1024),\
`g` VARCHAR(64),\
`h` VARCHAR(64),\
`i` VARCHAR(64),\
`j` VARCHAR(1024),\
`k` VARCHAR(64),\
`l` VARCHAR(64),\
`m` VARCHAR(64),\
`state` int default '0', \
PRIMARY KEY(`c`)\
)"

export function mysql_client() {
  return new Promise<Pool>((resolve, reject) => {
    if (global_connection) {
      resolve(global_connection)
    } else {
      createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PSWD,
      })
        .then((connection) => {
          return Promise.resolve()
            .then(() => connection.query(database_sql))
            .then(() => connection.query('use cmdata'))
            .then(() => connection.query(table_tut_sql))
            .then(() => connection.query(table_ect_sql))
            .then(() => connection.query(table_drop_spt_sql))
            .then(() => connection.query(table_spt_sql))
        })
        .then(() => {
          global_connection = createPool({
            multipleStatements: true,
            host: MYSQL_HOST,
            port: MYSQL_PORT,
            user: MYSQL_USER,
            password: MYSQL_PSWD,
            database: 'cmdata',
            connectionLimit: 10,
          })
          resolve(global_connection)
        })
        .catch(reject)
    }
  })
}
