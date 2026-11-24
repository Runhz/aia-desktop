# AIA 桌面助手

一个轻量的 Windows AI 助手。桌面随手问，划词就能提问，不必切窗口。

收起时保持简洁，展开后接着聊。需要查资料时，可以手动为下一条提问开启 DeepSeek 官方搜索，聊天仍使用你配置的模型。

## 复现

这里是基于 [AIA 划词助手](https://github.com/zcx960/AIA-selection-assistan) 的非官方定制补丁，不是完整 TypeScript 源码或独立安装包。

需要 Python 3、Node.js 22 或以上，以及自己持有的 **准确上一版** `AIA-Desktop-Two-Toggles-Update.zip`。它不是上游仓库的公开安装包，其他版本不能替代。把 ZIP 暂放仓库根目录；无需真实 API Key 或网络。旧补丁、应用、聊天记录和本机设置均不应提交。

```text
基线 ZIP SHA-256: f29d220b5ee8d8a36be6735bb9a86242000032aead00bcb7d4cbf9ebf69f94cc
预期 ASAR SHA-256: 347f072c236633485e7fc01c70cd8c3748c18c0bda9ebd2984d331118f91ddde
预期 ASAR 头 SHA-256: 5e20576a52f34cda201be02a5111f1e8200fc55d86c53d449c50883480a3cd99
```

运行顺序和离线测试见 [发布记录](RELEASE-NOTES.zh-CN.md)。运行后产生的更新 ZIP 只包含 ASAR 与版本校验清单，不能独立安装，也不适用于上游通用安装包或其他版本；不要直接替换已安装的 ASAR。Windows 自启动是单机配置，不属于此补丁或仓库。

## 来源与许可

原项目：[zcx960/AIA-selection-assistan](https://github.com/zcx960/AIA-selection-assistan)，MIT。原项目许可与版权声明见 [LICENSE](LICENSE)。本仓库不是上游官方版本。上游应用、Electron 运行时及其他第三方依赖、字体、图标等保留各自的许可；本仓库不包含这些捆绑二进制文件，不能以这里的 MIT 通知替代它们自己的再分发要求。
