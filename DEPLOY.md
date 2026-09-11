# 部署到自己的服务器

## 先理解当前项目

网站目前只有HTML、CSS和JavaScript，没有数据库、登录系统或服务端接口。因此服务器只需要提供静态文件，不需要执行`npm install`。

## 方法一：Docker部署

服务器需要已经安装Docker和Docker Compose插件：

```bash
git clone https://github.com/147196421/knitwear-factory-learning.git
cd knitwear-factory-learning
docker compose up -d --build
```

启动后先访问：

```text
http://服务器IP:8080
```

更新网站：

```bash
cd knitwear-factory-learning
git pull --ff-only
docker compose up -d --build
```

## 方法二：直接交给已有Nginx

如果服务器已经安装Nginx，可把仓库放在固定目录，并把站点根目录指向该仓库。核心配置为：

```nginx
server {
    listen 80;
    server_name learn.example.com;
    root /srv/knitwear-factory-learning;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

将`learn.example.com`替换为自己的域名，将`root`替换为实际绝对路径。

## 绑定自己的域名

1. 在域名服务商添加一条A记录，指向服务器公网IP。
2. 在服务器Nginx、Caddy或宝塔面板中添加该域名。
3. 反向代理到`http://127.0.0.1:8080`，或直接使用上面的静态目录配置。
4. 为域名申请HTTPS证书，并开启HTTP跳转HTTPS。

DNS生效前域名可能打不开。证书、开放端口和防火墙规则应在正式上线时按服务器环境配置。

## 当前适用范围

这套部署适合现在的公开学习网站。以后如果增加用户账号、后台编辑、数据库或私有工艺单存储，就需要另外部署后端和数据库，不能继续只靠静态Nginx。
