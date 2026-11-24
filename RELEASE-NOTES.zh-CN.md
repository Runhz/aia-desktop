# AIA：官方搜索与新对话

- 闲置输入框发送默认新建会话。展开后直接追问会延续当前会话；收起后可用 Ctrl+Shift+Y 继续上一次，也可在 Ctrl+H 历史打开任意会话。
- 模型切换改为小图标；编辑改为与气泡分开的无底色铅笔。代码块和独立公式有较深背景，悬停或键盘聚焦显示复制操作，复制源码。输入框展开带轻微减速和回弹，遵守系统减少动态效果。
- 深度思考控件已移除。搜索可独立使用 DeepSeek 官方 Search API，回答继续由现有模型完成；不从中转推断联网支持。中转用户在模型配置输入单独的 DeepSeek 官方搜索 Key。直连官方可复用官方聊天 Key。搜索只作用于下一次显式选择并发送，向官方发送当前输入前 128 个 Unicode 字符，不发送附件、划词数据或历史。最多请求一次，不自动重试；切换会话、打开历史或设置时取消本次搜索。失败或空结果给出提示，不生成假装查过的回答。
- 含结果的搜索按 DeepSeek 官方费率计费，模型费用另计。未使用真实 API Key 或发起真实请求验证。本更新不修改用户聊天和模型配置文件，配置搜索由用户主动操作。

# 开发复现说明

以当前上一版 AIA-Desktop-Two-Toggles-Update.zip 为唯一构建基线，包 SHA-256 f29d220b5ee8d8a36be6735bb9a86242000032aead00bcb7d4cbf9ebf69f94cc。依次运行：
    python3 extract_baseline.py
    cp -a base assembly
    python3 fresh_context.py assembly/out/renderer/assets/trial-DGJV07EL.js
    python3 official_search.py assembly
    node patch-structured-content.mjs assembly
    python3 patch-ui-polish.py assembly
    AIA_ASSEMBLY="${PWD}/assembly" node --test test-official-search.cjs
    python3 test_fresh_context.py
    node test-structured-content.mjs
    node test-ui-hooks.cjs assembly
    python3 package_release.py assembly AIA-Desktop-Official-Search-Update.zip
补丁针对精确已部署 ASAR 成员，未恢复新的 TypeScript 项目源文件。Chromium 脚本需要可启动的 Chromium 与 Playwright；不会使用真实网络接口。
