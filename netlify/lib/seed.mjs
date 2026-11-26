export const seedData = {
  "version": 1,
  "nextNumber": 11,
  "questions": [
    {
      "id": "q_seed_1",
      "number": 1,
      "title": "客户询价空压机时，第一次沟通需要确认哪些基础信息？",
      "body": "经常接到客户电话直接问价格，但用途、气量和现场条件都不清楚，报价往往要反复修改。\n\n想整理一份首次沟通的确认清单，大家在询价阶段通常会问哪些内容？",
      "category": "sales",
      "tags": [
        "询价",
        "选型",
        "客户沟通"
      ],
      "author": "李明",
      "department": "销售支持部",
      "status": "resolved",
      "views": 252,
      "createdAt": "2026-11-20T13:33:40.706Z",
      "updatedAt": "2026-11-20T19:33:40.711Z",
      "lastActivityAt": "2026-11-20T19:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_1_1",
          "body": "建议至少确认 8 项信息：\n1. 用途与用气场景，以及现有设备情况\n2. 所需排气量（m³/min）和排气压力（MPa）\n3. 用气是否连续、是否有峰值工况\n4. 电源条件、安装空间与防护要求\n5. 冷却方式（风冷 / 水冷）及现场条件\n6. 噪音、能效、露点等特殊要求\n7. 是否需要储气罐、冷干机等后处理设备\n8. 预算范围、期望交期和决策节点\n\n信息不全时先记录待确认项，不要直接承诺价格和交期。把清单附在询价记录里，后续交接也会更清楚。",
          "author": "张工",
          "department": "销售支持部",
          "createdAt": "2026-11-20T19:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_2",
      "number": 2,
      "title": "设备出现高温报警，现场排查应该按什么顺序进行？",
      "body": "客户现场偶尔出现高温报警，复位后还能运行。想统一一下远程和现场的排查顺序，避免遗漏关键项。",
      "category": "service",
      "tags": [
        "高温报警",
        "故障排查",
        "售后服务"
      ],
      "author": "王海",
      "department": "售后服务部",
      "status": "resolved",
      "views": 198,
      "createdAt": "2026-11-21T13:33:40.711Z",
      "updatedAt": "2026-11-21T15:33:40.711Z",
      "lastActivityAt": "2026-11-21T15:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_2_1",
          "body": "先安全停机，记录报警代码、环境温度、运行负载和故障发生时间。排查建议按“环境 → 冷却 → 油路 → 传感”的顺序：\n- 环境：机房通风、进排风空间、风道是否受阻\n- 冷却：风扇 / 水泵运行状态，散热器积灰，冷却水流量与水温\n- 油路：油位、油品状态，油滤与油分是否堵塞\n- 传感：温度传感器及线路是否松动、漂移\n\n复位后不要立即带载运行，先空载观察温度变化。反复报警时保留运行数据并升级给技术支援。具体报警阈值和处理参数，以对应机型的服务手册为准。",
          "author": "陈工",
          "department": "售后服务部",
          "createdAt": "2026-11-21T15:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_3",
      "number": 3,
      "title": "生产现场发现来料批次不合格，标准处理流程是什么？",
      "body": "来料检验发现关键尺寸超差，但生产计划很紧。现场应该先做什么，后续由谁评审？",
      "category": "quality",
      "tags": [
        "来料检验",
        "不合格品",
        "供应商管理"
      ],
      "author": "陈静",
      "department": "质量部",
      "status": "resolved",
      "views": 154,
      "createdAt": "2026-11-22T01:33:40.711Z",
      "updatedAt": "2026-11-22T03:33:40.711Z",
      "lastActivityAt": "2026-11-22T03:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_3_1",
          "body": "先隔离、标识、记录，不要让物料直接上线。\n\n基本流程：\n1. 开具不合格品单，附检验记录和照片\n2. 将物料移至不合格品区，防止误用\n3. 通知采购、工艺和生产共同进行 MRB 评审，评估让步接收、返工、退货或报废\n4. 涉及安全或关键性能特性时，不得自行让步\n5. 要求供应商提交原因分析和纠正措施，必要时做批次追溯\n\n急用不能替代评审；紧急放行必须走书面审批并明确风险。",
          "author": "刘工",
          "department": "质量部",
          "createdAt": "2026-11-22T03:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_4",
      "number": 4,
      "title": "报销单被财务退回，常见原因有哪些？",
      "body": "最近报销单经常被退回重填，想汇总一下高频问题发到部门群里，减少来回沟通。",
      "category": "hr",
      "tags": [
        "费用报销",
        "单据规范",
        "财务"
      ],
      "author": "周敏",
      "department": "综合管理部",
      "status": "resolved",
      "views": 312,
      "createdAt": "2026-11-22T11:33:40.711Z",
      "updatedAt": "2026-11-22T15:33:40.711Z",
      "lastActivityAt": "2026-11-22T15:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_4_1",
          "body": "常见退回原因主要有：\n- 发票抬头、税号错误，或发票类型不符合要求\n- 金额与行程、明细不一致，缺少附件\n- 未关联事前审批，或超出预算\n- 差旅标准超标且没有说明\n- 粘贴、扫描不清晰，或重复提交\n- 费用归属部门、科目选错\n\n提交前按“票据—审批—标准—信息”四项自查，能减少大部分退回。具体标准以最新财务制度为准。",
          "author": "赵老师",
          "department": "综合管理部",
          "createdAt": "2026-11-22T15:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_5",
      "number": 5,
      "title": "技术资料发给客户前，需要做哪些检查？",
      "body": "销售经常直接找技术部要图纸和参数表，有时还要得比较急。发给客户前应该怎么把控？",
      "category": "product",
      "tags": [
        "技术资料",
        "保密",
        "审批流程"
      ],
      "author": "周工",
      "department": "技术部",
      "status": "resolved",
      "views": 176,
      "createdAt": "2026-11-22T21:33:40.711Z",
      "updatedAt": "2026-11-23T01:33:40.711Z",
      "lastActivityAt": "2026-11-23T01:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_5_1",
          "body": "先确认用途和接收方，再做三步检查：\n1. 保密与授权：是否有 NDA 或保密要求，资料是否允许外发\n2. 内容脱敏：删除内部成本、供应商信息、未公开型号和客户信息\n3. 版本准确：使用受控版本，标注版本号和日期，避免发送过程稿\n\n涉及整机图纸、核心参数或非标方案时，需部门负责人审批，并留存外发记录。拿不准是否可发时，先问再发。",
          "author": "孙工",
          "department": "技术部",
          "createdAt": "2026-11-23T01:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_6",
      "number": 6,
      "title": "紧急采购申请怎么提，才能尽量不影响交期？",
      "body": "现场备件急用，常规流程走完来不及，有没有更快的处理方式？",
      "category": "supply",
      "tags": [
        "紧急采购",
        "交期",
        "备件管理"
      ],
      "author": "孙浩",
      "department": "采购部",
      "status": "resolved",
      "views": 122,
      "createdAt": "2026-11-23T07:33:40.711Z",
      "updatedAt": "2026-11-23T09:33:40.711Z",
      "lastActivityAt": "2026-11-23T09:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_6_1",
          "body": "在申请单中明确“紧急原因、需求时间、停机影响”，并同步采购负责人。\n\n能提供型号、替代件和预算上限的，优先走加急评审；型号不确定的，先发铭牌照片和现场信息。紧急采购不等于跳过审批，事后仍需补齐比价和单据。\n\n建议各班组梳理高频易损件，设置安全库存，减少临时急采。",
          "author": "钱工",
          "department": "采购部",
          "createdAt": "2026-11-23T09:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_7",
      "number": 7,
      "title": "公司邮箱在手机上怎么配置？",
      "body": "出差时需要手机收邮件，应该找谁要参数，怎么设置比较安全？",
      "category": "it",
      "tags": [
        "邮箱配置",
        "移动办公",
        "信息安全"
      ],
      "author": "林晓",
      "department": "信息部",
      "status": "resolved",
      "views": 267,
      "createdAt": "2026-11-23T13:33:40.711Z",
      "updatedAt": "2026-11-23T17:33:40.711Z",
      "lastActivityAt": "2026-11-23T17:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_7_1",
          "body": "先向 IT 获取邮箱协议、服务器地址和端口，不要使用他人账号测试。\n\n配置时建议：\n- 使用授权码，避免直接填写登录密码\n- 开启 SSL/TLS 加密\n- 设置锁屏密码，不把账号密码写在便签里\n- 离职或设备转交时及时解绑\n\n若提示认证失败，先确认账号状态和授权码是否过期，再联系 IT 处理。",
          "author": "IT 支持",
          "department": "信息部",
          "createdAt": "2026-11-23T17:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_8",
      "number": 8,
      "title": "装配现场发现图纸版本与工单不一致，应该以哪个为准？",
      "body": "装配时发现工单附带的图纸和现场受控图纸版本不一致，现场应该先停线吗？以哪个为准？",
      "category": "production",
      "tags": [
        "图纸版本",
        "工单",
        "变更管理"
      ],
      "author": "徐峰",
      "department": "生产部",
      "status": "resolved",
      "views": 89,
      "createdAt": "2026-11-23T19:33:40.711Z",
      "updatedAt": "2026-11-24T01:33:40.711Z",
      "lastActivityAt": "2026-11-24T01:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_8_1",
          "body": "先停线确认，不要凭经验自行判断。\n\n处理原则：\n1. 以受控系统中的最新版图纸 / BOM 为准\n2. 由工艺工程师核对工单和变更记录，确认是否漏发变更\n3. 如确需按旧版生产，必须走书面 deviation / 变更审批，并记录影响批次\n4. 任何口头变更都要补齐书面记录\n\n处理完成后，把版本差异反馈给文控和工艺，避免同类问题重复发生。",
          "author": "工艺组",
          "department": "生产部",
          "createdAt": "2026-11-24T01:33:40.711Z",
          "accepted": true,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_9",
      "number": 9,
      "title": "新同事入职第一周，部门需要准备哪些事项？",
      "body": "想做一个部门入职清单，避免每次都临时补。除了领电脑和工牌，还应该安排什么？",
      "category": "hr",
      "tags": [
        "入职",
        "部门协作",
        "新人指引"
      ],
      "author": "赵老师",
      "department": "综合管理部",
      "status": "open",
      "views": 64,
      "createdAt": "2026-11-24T05:33:40.711Z",
      "updatedAt": "2026-11-24T08:33:40.711Z",
      "lastActivityAt": "2026-11-24T08:33:40.711Z",
      "isSample": true,
      "answers": [
        {
          "id": "a_seed_9_1",
          "body": "建议先列一个清单：工位与办公用品、系统账号与权限、部门介绍与导师、岗位目标与试用期计划、安全与保密培训。欢迎大家补充各组一直沿用的做法。",
          "author": "周敏",
          "department": "综合管理部",
          "createdAt": "2026-11-24T08:33:40.711Z",
          "accepted": false,
          "reviewStatus": "approved"
        }
      ],
      "reviewStatus": "approved"
    },
    {
      "id": "q_seed_10",
      "number": 10,
      "title": "客户来访参观工厂，需要提前准备哪些资料？",
      "body": "下个月有客户要来参观，除了展厅和产线参观路线，还需要提前准备哪些介绍材料？",
      "category": "sales",
      "tags": [
        "客户接待",
        "工厂参观"
      ],
      "author": "王海",
      "department": "销售支持部",
      "status": "open",
      "views": 31,
      "createdAt": "2026-11-24T08:33:40.711Z",
      "updatedAt": "2026-11-24T08:33:40.711Z",
      "lastActivityAt": "2026-11-24T08:33:40.711Z",
      "isSample": true,
      "answers": [],
      "reviewStatus": "approved"
    }
  ]
};
