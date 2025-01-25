const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const dbPath = path.join(__dirname,'db.json')
const l = console.log
let mockData = {};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  l(pathname,req.method)
  /**
   * 程序主页面渲染
   */
  if (pathname === '/' || pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(data);
    });
    return;
  }

  /**
   * 添加动态api数据
   * post请求
   */
  if (pathname === '/addMock' && req.method === 'POST') {
    let body = null
    req.on('data', chunk => {  body = JSON.parse(chunk.toString())  })
    req.on('end', () => {
      // 判断数据库文件是否存在，不存在创建文件数据库
      if(!fs.existsSync(dbPath)) fs.writeFileSync(dbPath,'[]')

      // 获取数据库数据
      const dbData = JSON.parse(fs.readFileSync(dbPath).toString())
      dbData.push(body)

      // 写入数据库
      fs.writeFileSync(dbPath,JSON.stringify(dbData))
      
      // 更细缓存
      mockData[body.path] = body
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('提交成功');
    });
    return;
  }

  /**
   * 获取动态api数据
   */
  if (pathname === '/getMock') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(Object.values(mockData)))
    return;
  }

  /**
   * 删除动态api数据
   */
  if (pathname === '/delMock') {
    res.writeHead(200, {'Content-Type': 'application/json'});

    // 解码请求路径
    const body = querystring.parse(parsedUrl.query)
    const path = decodeURI(body.path) 

    // 删除缓存的数据
    delete mockData[path]

    // 更新文件数据库
    fs.writeFileSync(dbPath,JSON.stringify(Object.values(mockData)))
    res.end('删除成功')
    return;
  }

  // 动态api接口匹配处理
  const mockItem = mockData[pathname]
  // l(mockData,mockItem)
  if (mockItem && req.method === mockItem.method) {
    const resData = mockItem.response
    const header = {}
    let body = null
    if(req.method === 'GET' || req.headers['content-type'] === 'x-www-form-urlencoded'){
      // get请求体解析
      body = querystring.parse(parsedUrl.query)

      // 响应数据参数模板替换
      let data = body ? resData.replace(/\{\{.*\}\}/g,data => body[data.slice(2,-2)]) : resData

      // 默认响应数据按json解析
      try { data = JSON.parse(data) } catch (error) {}

      // 钩子函数执行
      if(mockItem.hook) data = new Function('body','resData','header',mockItem.hook.slice(30,-1))(body,data,header) || data

      // 钩子函数修改的响应头应用
      res.writeHead(header.statusCode || 200, Object.assign({'Content-Type': 'application/json'},header));
      res.end(typeof data === 'string' ? data : JSON.stringify(data))
      return;
    }
    else{
      // post请求体解析
      req.on('data', chunk => {  body = JSON.parse(chunk.toString())  })
      req.on('end', () => {

        // 响应数据参数模板替换
        let data = body ? resData.replace(/\{\{.*\}\}/g,data => body[data.slice(2,-2)]) : resData
        
        // 默认响应数据按json解析
        try { data = JSON.parse(data) } catch (error) {}

        // 钩子函数执行
        if(mockItem.hook) data = new Function('body','resData','header',mockItem.hook.slice(30,-1))(body,data,header) || data

        // 钩子函数修改的响应头应用
        res.writeHead(header.statusCode || 200, Object.assign({'Content-Type': 'application/json'},header));
        res.end(typeof data === 'string' ? data : JSON.stringify(data))
      });
      return;
    }

    
  }

  // 如果请求不匹配任何已定义的路由
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not Found');
});
server.listen(3000, () => {l('Server is listening on port 3000')})

// 加载历史数据
if(fs.existsSync(dbPath)){
  const dbData = JSON.parse(fs.readFileSync(dbPath).toString())
  dbData.forEach(v => mockData[v.path] = v)
}

