/* ============================================================
 * 规则库 单一数据源 —— 规则列表 / 版本 / 模板（演示用）
 * ------------------------------------------------------------
 * 规则库页与「新建 / 编辑规则」页共用这里的数据：
 *   - 规则库页首屏渲染「规则列表」（SEED + 本机新增）；
 *   - 新建 / 编辑规则页保存后写入 localStorage，规则库页即时可见。
 * 与 roles.js 分工：roles.js 管「谁能做」，本文件管「有什么规则」。
 * 加载顺序：在 assets/app.js 之前或之后均可，但必须在页面脚本之前。
 * ============================================================ */
window.RULE_STORE = (function () {
  'use strict';

  const K = 'cnas_rules_v1';

  /* ---------- 种子规则（内置，不随清除 localStorage 消失） ---------- */
  const SEED = [
    {
      id: 'calib', name: '设备校准到期预警', ver: 'v2.1', on: true,
      trigger: '定时触发（每日 08:00）', freq: '365 次', last: '12-01 08:00',
      conds: [{ field: '校准到期日', op: '≤', val: '30天', join: 'AND' }],
      acts: [{ act: '发送通知', who: '设备负责人', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '待分派' }],
      expr: 'IF 设备校准到期日 ≤ 30天 → 发送系统通知设备负责人 + 生成预警事件'
    },
    {
      id: 'ncr', name: '不符合项超期告警', ver: 'v1.3', on: true,
      trigger: '定时触发（每日 09:00）', freq: '48 次', last: '12-01 09:00',
      conds: [{ field: '整改截止日', op: '≤', val: '今天', join: 'AND' },
              { field: '事件状态', op: '≠', val: '已关闭', join: 'AND' }],
      acts: [{ act: '发送通知', who: '质量负责人', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '升级' }],
      expr: 'IF NCR 整改截止日期已过期且状态未关闭 → 发送告警至质量负责人 + 升级处理级别'
    },
    {
      id: 'intake', name: '样本入库质量检查', ver: 'v3.0', on: true,
      trigger: '样本接收事件触发', freq: '1240 次', last: '12-01 11:32',
      conds: [{ field: '储存温度', op: '≤', val: '-60℃', join: 'OR' },
              { field: '样本编号', op: '为空', val: '', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '入库流程', how: '拒绝入库' },
             { act: '生成事件', who: '事件管控中心', how: '待分派' }],
      expr: 'IF 样本温度超出可接受范围 OR 标识信息不完整 → 拒绝入库 + 生成质量异常记录 + 通知采集方'
    },
    {
      id: 'archive', name: '文件版本自动归档', ver: 'v1.1', on: true,
      trigger: '文件更新事件触发', freq: '89 次', last: '11-28 16:15',
      conds: [{ field: '文件状态', op: '=', val: '已审批', join: 'AND' }],
      acts: [{ act: '写入日志', who: '操作日志', how: '触发日志' },
             { act: '发送通知', who: '文件持有人', how: '系统通知' }],
      expr: 'IF 文件状态变更为「已审批」 → 旧版本标记为「已废止」 + 发送变更通知给相关人员'
    },
    {
      id: 'ln2', name: '液氮液位低告警', ver: 'v1.0', on: false,
      trigger: '传感器数据触发', freq: '12 次', last: '09-20 03:14',
      conds: [{ field: '液氮液位', op: '≤', val: '30%', join: 'AND' }],
      acts: [{ act: '发送通知', who: '样本管理员', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '待分派' }],
      expr: 'IF 液氮液位 < 30% → 立即发送系统通知至储存管理员 + 触发补液流程'
    }
  ];

  /* ---------- GB/T 37864-2019 内置规则集（由标准第 4–8 章提取） ---------- */
  const GB37864_SEED = [
    {
      id: 'gb37864-4-1-6', name: '伦理审查与知情同意校验', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '4.1.6 / 7.2.3.4',
      trigger: '样本采集 / 研究项目立项', freq: '0 次', last: '—',
      conds: [{ field: '伦理批件', op: '为空', val: '', join: 'OR' },
              { field: '知情同意', op: '=', val: '缺失', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '采集登记', how: '拒绝登记' },
             { act: '生成事件', who: '事件管控中心', how: '合规不符合项' }],
      expr: 'IF 采集项目缺少伦理批件或知情同意 → 阻断采集登记 + 生成合规不符合项'
    },
    {
      id: 'gb37864-4-2', name: '公正性与保密承诺', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '4.2 / 4.3.4',
      trigger: '新员工入职 / 年度复核', freq: '0 次', last: '—',
      conds: [{ field: '公正性承诺', op: '=', val: '未签署', join: 'OR' },
              { field: '保密协议', op: '=', val: '已过期', join: 'OR' }],
      acts: [{ act: '发送通知', who: '员工本人', how: '待办提醒' },
             { act: '写入日志', who: '操作日志', how: '承诺状态' }],
      expr: 'IF 员工未签署公正性承诺或保密协议已过期 → 生成签署任务 + 暂停机密数据访问'
    },
    {
      id: 'gb37864-4-3-2', name: '样本与数据分发授权', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '4.3.2 / 7.3.3.2',
      trigger: '样本 / 数据分发申请', freq: '0 次', last: '—',
      conds: [{ field: '伦理批件', op: '为空', val: '', join: 'OR' },
              { field: 'MTA/DTA', op: '为空', val: '', join: 'OR' },
              { field: '授权文件', op: '=', val: '未签署', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '分发流程', how: '拒绝分发' },
             { act: '发送通知', who: '数据管理员', how: '系统通知' }],
      expr: 'IF 分发申请缺少伦理批件、MTA/DTA 或授权文件 → 拒绝分发 + 通知数据管理员'
    },
    {
      id: 'gb37864-5-8', name: '岗位职责与质量职责文件化', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '5.8 / 5.9',
      trigger: '岗位新增 / 变更', freq: '0 次', last: '—',
      conds: [{ field: '岗位说明书', op: '为空', val: '', join: 'OR' },
              { field: '质量职责', op: '=', val: '未分配', join: 'OR' }],
      acts: [{ act: '生成事件', who: '体系专员', how: '待办任务' },
             { act: '发送通知', who: '部门负责人', how: '系统通知' }],
      expr: 'IF 岗位缺少岗位说明书或质量职责未分配 → 生成文件补全任务 + 通知部门负责人'
    },
    {
      id: 'gb37864-6-2-2', name: '人员能力评估到期提醒', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '6.2.2.4 / 6.2.2.5',
      trigger: '定时触发（每季度）', freq: '0 次', last: '—',
      conds: [{ field: '能力评估到期日', op: '≤', val: '30天', join: 'AND' }],
      acts: [{ act: '发送通知', who: '岗位负责人', how: '系统通知' },
             { act: '生成事件', who: '培训管理', how: '能力评估任务' }],
      expr: 'IF 人员能力评估将在 30 天内到期或尚未评估 → 生成评估任务 + 通知岗位负责人'
    },
    {
      id: 'gb37864-6-2-3', name: '培训与上岗授权校验', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '6.2.3.1 / 6.2.3.2',
      trigger: '新员工入职 / 培训到期', freq: '0 次', last: '—',
      conds: [{ field: '上岗培训', op: '=', val: '未完成', join: 'OR' },
              { field: '培训有效期', op: '≤', val: '今天', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '关键岗位', how: '暂停授权' },
             { act: '生成事件', who: '培训管理', how: '培训任务' }],
      expr: 'IF 员工未完成上岗培训或培训已过期 → 暂停关键操作权限 + 生成培训任务'
    },
    {
      id: 'gb37864-6-3-5', name: '设施环境超限告警', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '6.3.5',
      trigger: '传感器数据触发', freq: '0 次', last: '—',
      conds: [{ field: '温度', op: '超出', val: '设定范围', join: 'OR' },
              { field: '湿度', op: '超出', val: '设定范围', join: 'OR' },
              { field: '洁净度', op: '超出', val: '设定范围', join: 'OR' }],
      acts: [{ act: '发送通知', who: '设施负责人', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '环境偏差' }],
      expr: 'IF 温度、湿度或洁净度超出设定范围 → 发送告警 + 生成环境偏差事件 + 记录监测数据'
    },
    {
      id: 'gb37864-6-3-7', name: '应急预案演练到期', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '6.3.7',
      trigger: '定时触发（每年）', freq: '0 次', last: '—',
      conds: [{ field: '上次演练日期', op: '>', val: '12个月', join: 'AND' }],
      acts: [{ act: '生成事件', who: '设施负责人', how: '演练任务' },
             { act: '发送通知', who: '质量负责人', how: '系统通知' }],
      expr: 'IF 停电、极端天气等应急预案超过 12 个月未演练 → 生成演练任务 + 通知质量负责人'
    },
    {
      id: 'gb37864-6-4-2', name: '外部供应商再评价', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '6.4.2',
      trigger: '定时触发（每年）', freq: '0 次', last: '—',
      conds: [{ field: '供应商再评价日期', op: '≤', val: '今天', join: 'OR' },
              { field: '供应商评价结果', op: '=', val: '不合格', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '采购 / 服务', how: '冻结合作' },
             { act: '生成事件', who: '采购管理', how: '再评价任务' }],
      expr: 'IF 外部供应商年度再评价到期或评价不合格 → 冻结采购/服务 + 生成再评价任务'
    },
    {
      id: 'gb37864-6-5-8', name: '设备校准与维护到期', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '6.5.8 / 6.5.11',
      trigger: '定时触发（每日 08:00）', freq: '0 次', last: '—',
      conds: [{ field: '校准到期日', op: '≤', val: '30天', join: 'OR' },
              { field: '维护到期日', op: '≤', val: '30天', join: 'OR' },
              { field: '设备状态', op: '=', val: '故障', join: 'OR' }],
      acts: [{ act: '发送通知', who: '设备负责人', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '设备预警' }],
      expr: 'IF 关键设备校准/维护将在 30 天内到期或设备故障 → 发送通知 + 生成事件 + 锁定设备使用'
    },
    {
      id: 'gb37864-6-5-12', name: '设备缺陷影响评估', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '6.5.12 / 7.11',
      trigger: '设备故障 / 偏离登记', freq: '0 次', last: '—',
      conds: [{ field: '设备状态', op: '=', val: '故障或超限', join: 'AND' },
              { field: '影响评估', op: '=', val: '未完成', join: 'AND' }],
      acts: [{ act: '生成事件', who: '质量负责人', how: '影响评估任务' },
             { act: '阻断操作', who: '相关批次', how: '暂停放行' }],
      expr: 'IF 设备缺陷可能影响样本或数据质量且未完成影响评估 → 暂停相关批次放行 + 生成评估任务'
    },
    {
      id: 'gb37864-7-2-1', name: '样本采集信息完整性', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.2.1.1',
      trigger: '样本采集登记', freq: '0 次', last: '—',
      conds: [{ field: '采集日期', op: '为空', val: '', join: 'OR' },
              { field: '采集场所', op: '为空', val: '', join: 'OR' },
              { field: '采集程序', op: '为空', val: '', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '采集登记', how: '退回补录' },
             { act: '发送通知', who: '采集人员', how: '待办提醒' }],
      expr: 'IF 采集日期、场所、程序或相关信息缺失 → 阻断登记 + 退回采集人员补录'
    },
    {
      id: 'gb37864-7-3-2', name: '接收隔离与合规评估', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.3.2.4',
      trigger: '样本接收登记', freq: '0 次', last: '—',
      conds: [{ field: '法律/伦理/质量评估', op: '=', val: '未完成', join: 'AND' }],
      acts: [{ act: '阻断操作', who: '入库流程', how: '隔离保存' },
             { act: '生成事件', who: '样本管理员', how: '待评估任务' }],
      expr: 'IF 接收样本尚未完成法律、伦理、文件和质量评估 → 自动隔离 + 生成待评估任务'
    },
    {
      id: 'gb37864-7-4-2', name: '运输条件与监管链', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.4.2',
      trigger: '运输任务开始 / 结束', freq: '0 次', last: '—',
      conds: [{ field: '运输温度', op: '超出', val: '允许范围', join: 'OR' },
              { field: '运输时长', op: '超出', val: '允许范围', join: 'OR' },
              { field: '监管链记录', op: '为空', val: '', join: 'OR' }],
      acts: [{ act: '发送通知', who: '接收方', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '运输偏离' }],
      expr: 'IF 运输温度、时长或监管链记录超限/缺失 → 标记偏离 + 通知接收方 + 生成不符合项'
    },
    {
      id: 'gb37864-7-5-1', name: '样本全链路追溯校验', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.5.1',
      trigger: '样本状态变更', freq: '0 次', last: '—',
      conds: [{ field: '唯一标识', op: '为空', val: '', join: 'OR' },
              { field: '储存位置', op: '为空', val: '', join: 'OR' },
              { field: '分发记录', op: '为空', val: '', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '状态流转', how: '拒绝流转' },
             { act: '生成事件', who: '样本管理员', how: '追溯核查' }],
      expr: 'IF 样本唯一标识、位置或分发记录缺失 → 阻断状态流转 + 生成追溯核查任务'
    },
    {
      id: 'gb37864-7-7-3', name: '储存条件与库存核查', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.7.3 / 7.7.7',
      trigger: '传感器 / 库存盘点', freq: '0 次', last: '—',
      conds: [{ field: '储存温度', op: '超出', val: '设定范围', join: 'OR' },
              { field: '库存盘点差异', op: '>', val: '0', join: 'OR' }],
      acts: [{ act: '生成事件', who: '样本管理员', how: '库存异常' },
             { act: '阻断操作', who: '差异样本', how: '冻结流转' }],
      expr: 'IF 储存温度超限或库存盘点存在差异 → 生成事件 + 冻结差异样本 + 通知样本管理员'
    },
    {
      id: 'gb37864-7-8-2', name: '质控超限与趋势异常', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.8.2.2 / 7.8.2.3 / 7.8.2.10',
      trigger: '质控数据触发', freq: '0 次', last: '—',
      conds: [{ field: 'QC 结果', op: '超出', val: '既定准则', join: 'OR' },
              { field: 'QC 趋势', op: '=', val: '异常', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '问题批次', how: '停止分发' },
             { act: '生成事件', who: '质量负责人', how: '不符合项' }],
      expr: 'IF QC 结果超出既定准则或趋势异常 → 停止问题批次分发 + 生成不符合项 + 通知质量负责人'
    },
    {
      id: 'gb37864-7-9-2', name: '方法确认与验证', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.9.2.3 / 7.9.3.1',
      trigger: '关键方法新增 / 变更', freq: '0 次', last: '—',
      conds: [{ field: '方法确认状态', op: '=', val: '未完成', join: 'OR' },
              { field: '方法验证状态', op: '=', val: '未完成', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '方法启用', how: '拒绝启用' },
             { act: '生成事件', who: '技术负责人', how: '确认/验证任务' }],
      expr: 'IF 关键方法变更未完成确认或验证 → 阻断方法启用 + 生成确认/验证任务'
    },
    {
      id: 'gb37864-7-10-3', name: '数据备份与完整性', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.10.3',
      trigger: '定时触发（每日 02:00）', freq: '0 次', last: '—',
      conds: [{ field: '备份任务', op: '=', val: '失败', join: 'OR' },
              { field: '完整性校验', op: '=', val: '异常', join: 'OR' }],
      acts: [{ act: '发送通知', who: '系统管理员', how: '系统通知' },
             { act: '生成事件', who: '事件管控中心', how: '数据安全事件' }],
      expr: 'IF 数据备份失败或完整性校验异常 → 发送告警 + 生成运维事件 + 记录审计日志'
    },
    {
      id: 'gb37864-7-11-1', name: '不符合输出处置', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.11.1.4 / 7.11.2.1',
      trigger: '不符合输出登记', freq: '0 次', last: '—',
      conds: [{ field: '风险评估', op: '=', val: '未完成', join: 'OR' },
              { field: '召回决定', op: '=', val: '未做出', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '不符合批次', how: '隔离/召回' },
             { act: '生成事件', who: '质量负责人', how: 'CAPA 任务' }],
      expr: 'IF 不符合输出未完成风险评估或召回决定 → 隔离/召回 + 通知接收方 + 生成 CAPA'
    },
    {
      id: 'gb37864-7-12-2', name: '报告完整性校验', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.12.2.1',
      trigger: '报告生成 / 审核', freq: '0 次', last: '—',
      conds: [{ field: '报告唯一编号', op: '为空', val: '', join: 'OR' },
              { field: '样本标识', op: '为空', val: '', join: 'OR' },
              { field: '批准人', op: '为空', val: '', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '报告发布', how: '退回补全' },
             { act: '发送通知', who: '报告编制人', how: '系统通知' }],
      expr: 'IF 报告缺少唯一编号、样本标识、方法或批准人 → 阻断发布 + 退回补全'
    },
    {
      id: 'gb37864-7-13-2', name: '投诉闭环时限', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '7.13.2 / 7.13.6',
      trigger: '投诉登记 / 超时检查', freq: '0 次', last: '—',
      conds: [{ field: '投诉状态', op: '≠', val: '已关闭', join: 'AND' },
              { field: '投诉时长', op: '>', val: '约定时限', join: 'AND' }],
      acts: [{ act: '发送通知', who: '质量负责人', how: '升级提醒' },
             { act: '生成事件', who: '事件管控中心', how: '整改任务' }],
      expr: 'IF 投诉超过约定时限未调查或回复 → 升级至质量负责人 + 生成整改任务'
    },
    {
      id: 'gb37864-8-3-2', name: '文件审批与版本控制', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '8.3.2',
      trigger: '文件新增 / 修订', freq: '0 次', last: '—',
      conds: [{ field: '审批状态', op: '=', val: '未批准', join: 'OR' },
              { field: '版本标识', op: '为空', val: '', join: 'OR' },
              { field: '作废标识', op: '=', val: '缺失', join: 'OR' }],
      acts: [{ act: '阻断操作', who: '文件发布', how: '拒绝发布' },
             { act: '生成事件', who: '体系专员', how: '文件控制任务' }],
      expr: 'IF 文件未经审批、版本未更新或作废文件未标识 → 阻断发布 + 生成文件控制任务'
    },
    {
      id: 'gb37864-8-4-2', name: '记录保存与归档', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '8.4.2',
      trigger: '定时触发（每月）', freq: '0 次', last: '—',
      conds: [{ field: '记录保存期限', op: '≤', val: '到期', join: 'OR' },
              { field: '备份状态', op: '=', val: '缺失', join: 'OR' }],
      acts: [{ act: '生成事件', who: '记录管理员', how: '归档/备份任务' },
             { act: '写入日志', who: '操作日志', how: '归档记录' }],
      expr: 'IF 记录接近保存期限或备份缺失 → 生成归档/备份任务 + 通知记录管理员'
    },
    {
      id: 'gb37864-8-5-2', name: '风险与应急预案评审', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '8.5.2',
      trigger: '定时触发（每半年）', freq: '0 次', last: '—',
      conds: [{ field: '风险评估', op: '=', val: '过期', join: 'OR' },
              { field: '应急预案', op: '=', val: '缺失', join: 'OR' }],
      acts: [{ act: '生成事件', who: '质量负责人', how: '风险评估任务' },
             { act: '发送通知', who: '管理层', how: '系统通知' }],
      expr: 'IF 风险评估过期或应急预案缺失 → 生成风险评估/预案评审任务 + 通知管理层'
    },
    {
      id: 'gb37864-8-7-1', name: '纠正措施有效性验证', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '8.7.1 / 8.7.3',
      trigger: 'CAPA 到期 / 关闭', freq: '0 次', last: '—',
      conds: [{ field: 'CAPA 状态', op: '=', val: '到期未验证', join: 'OR' },
              { field: '验证结果', op: '=', val: '无效', join: 'OR' }],
      acts: [{ act: '生成事件', who: '质量负责人', how: '重新开启 CAPA' },
             { act: '发送通知', who: '责任部门', how: '升级提醒' }],
      expr: 'IF 纠正措施到期未验证或验证无效 → 升级事件 + 重新开启 CAPA + 通知责任部门'
    },
    {
      id: 'gb37864-8-8-1', name: '内部审核计划执行', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '8.8.1 / 8.8.2',
      trigger: '定时触发（每季度）', freq: '0 次', last: '—',
      conds: [{ field: '内审计划日期', op: '≤', val: '今天', join: 'OR' },
              { field: '上次不符合闭环', op: '=', val: '未完成', join: 'OR' }],
      acts: [{ act: '生成事件', who: '质量负责人', how: '内审任务' },
             { act: '发送通知', who: '内审小组', how: '系统通知' }],
      expr: 'IF 内部审核计划到期或上次不符合未闭环 → 生成内审任务 + 通知质量负责人'
    },
    {
      id: 'gb37864-8-9-1', name: '管理评审周期提醒', ver: 'v1.0', on: true,
      source: 'GB/T 37864-2019', clause: '8.9.1 / 8.9.3',
      trigger: '定时触发（每年）', freq: '0 次', last: '—',
      conds: [{ field: '上次管理评审日期', op: '>', val: '12个月', join: 'AND' }],
      acts: [{ act: '生成事件', who: '最高管理者', how: '管理评审任务' },
             { act: '发送通知', who: '管理层', how: '系统通知' }],
      expr: 'IF 管理评审超过 12 个月未开展 → 生成管理评审任务 + 通知最高管理者'
    }
  ];

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
  }

  const api = {
    SEED: SEED.concat(GB37864_SEED),

    /** 全部规则：本机新增的排在前面，其次内置种子（含启停覆盖） */
    all: function () {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      const extra = Array.isArray(patch.extra) ? patch.extra : [];
      const off = Array.isArray(patch.off) ? patch.off : [];
      const on = Array.isArray(patch.on) ? patch.on : [];
      const seed = SEED.concat(GB37864_SEED).map(function (r) {
        const copy = JSON.parse(JSON.stringify(r));
        if (off.indexOf(r.id) >= 0) copy.on = false;
        if (on.indexOf(r.id) >= 0) copy.on = true;
        return copy;
      });
      return extra.concat(seed).map(function (r) {
        const c = Object.assign({}, r);
        if (!c.source) c.source = '内部规则';
        if (!c.clause) c.clause = '—';
        return c;
      });
    },
    byId: function (id) {
      return api.all().filter(function (r) { return r.id === id; })[0] || null;
    },
    /** 新增（新建 / 套用模板 / 由编排页保存） */
    add: function (rule) {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.extra = patch.extra || [];
      patch.extra.unshift(rule);
      write(K, patch);
      return rule;
    },
    /** 更新已有规则的编排内容（编辑页保存） */
    update: function (id, next) {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.extra = patch.extra || [];
      const i = patch.extra.map(function (r) { return r.id; }).indexOf(id);
      if (i >= 0) { patch.extra[i] = Object.assign({}, patch.extra[i], next); write(K, patch); return; }
      const seed = SEED.concat(GB37864_SEED).filter(function (r) { return r.id === id; })[0];
      if (seed) { patch.extra.unshift(Object.assign({}, seed, next, { id: id })); write(K, patch); }
    },
    /** 启停切换（内置与新增都记录覆盖） */
    toggle: function (id) {
      const cur = api.byId(id);
      if (!cur) return null;
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.off = patch.off || []; patch.on = patch.on || [];
      const next = !cur.on;
      ['off', 'on'].forEach(function (k) { const i = patch[k].indexOf(id); if (i >= 0) patch[k].splice(i, 1); });
      patch[k_helper(next)].push(id);
      // 新增规则直接改自身 on
      patch.extra = (patch.extra || []).map(function (r) { return r.id === id ? Object.assign({}, r, { on: next }) : r; });
      write(K, patch);
      return next;
    },
    remove: function (id) {
      const patch = read(K, { extra: [], off: [], on: [] }) || { extra: [], off: [], on: [] };
      patch.extra = (patch.extra || []).filter(function (r) { return r.id !== id; });
      patch.off = (patch.off || []).filter(function (x) { return x !== id; });
      patch.on = (patch.on || []).filter(function (x) { return x !== id; });
      write(K, patch);
    },
    reset: function () { try { localStorage.removeItem(K); } catch (e) { } }
  };

  function k_helper(next) { return next ? 'on' : 'off'; }

  return api;
})();
