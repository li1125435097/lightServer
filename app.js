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
  // 处理前端页面的请求
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
   * 处理添加mock数据的请求 
   * post请求
   */
  if (pathname === '/addMock' && req.method === 'POST') {
    let body = null
    req.on('data', chunk => {  body = JSON.parse(chunk.toString())  })
    req.on('end', () => {
      if(!fs.existsSync(dbPath)) fs.writeFileSync(dbPath,'[]')
      const dbData = JSON.parse(fs.readFileSync(dbPath).toString())
      dbData.push(body)
      fs.writeFileSync(dbPath,JSON.stringify(dbData))
      mockData[body.path] = body
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('添加成功');
    });
    return;
  }

  // 处理mock数据的请求
  if (pathname === '/getMock') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(Object.values(mockData)))
    return;
  }

  // 处理mock数据的请求
  if (pathname === '/delMock') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    const body = querystring.parse(parsedUrl.query)
    const path = decodeURI(body.path) 
    delete mockData[path]
    fs.writeFileSync(dbPath,JSON.stringify(Object.values(mockData)))
    res.end('删除成功')
    return;
  }

  // 处理mock数据的请求
  const mockItem = mockData[pathname]
  // l(mockData,mockItem)
  if (mockItem && req.method === mockItem.method) {
    const resData = mockItem.response
    const header = {}
    let body = null
    if(req.method === 'GET' || req.headers['content-type'] === 'x-www-form-urlencoded'){
      body = querystring.parse(parsedUrl.query)
      let data = body ? resData.replace(/\{\{.*\}\}/g,data => body[data.slice(2,-2)]) : resData
      try { data = JSON.parse(data) } catch (error) {}
      if(mockItem.hook) data = new Function('body','resData','header',mockItem.hook.slice(30,-1))(body,data,header) || data
      res.writeHead(header.statusCode || 200, Object.assign({'Content-Type': 'application/json'},header));
      res.end(typeof data === 'string' ? data : JSON.stringify(data))
      return;
    }
    else{
      req.on('data', chunk => {  body = JSON.parse(chunk.toString())  })
      req.on('end', () => {
        let data = body ? resData.replace(/\{\{.*\}\}/g,data => body[data.slice(2,-2)]) : resData
        try { data = JSON.parse(data) } catch (error) {}
        if(mockItem.hook) data = new Function('body','resData','header',mockItem.hook.slice(30,-1))(body,data,header) || data
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

