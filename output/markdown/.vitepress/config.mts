import { defineConfig } from 'vitepress'
import dns from 'node:dns'
import fetch from 'node-fetch'

dns.setDefaultResultOrder('verbatim')

function org() {
  return {
    title: 'diagmindtw',
    description: '醫學國考知識庫',
    lang: 'zh-TW',
    server: {
      cors: {
        origin: ['sip.diagmindtw.com', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
      },
      allowedHosts: ['sip.diagmindtw.com', 'localhost']
    },
    themeConfig: {
      nav: [
        { text: 'Home', link: 'diagmindtw.com' },
        { text: 'Examples', link: '/markdown-examples' }
      ],
      sidebar: [
  {
    text: 'SurgicalDepartment',
    items: [
      {
        text: 'GS',
        link: '/SurgicalDepartment-GS-2.md'
      },
      {
        text: 'Acute adomen',
        link: '/SurgicalDepartment-Acute adomen-3.md'
      },
      {
        text: '圖庫資源',
        link: '/SurgicalDepartment-圖庫資源-4.md'
      }
    ]
  }
],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
      ]
    }
  };
}

const config = org();
export default defineConfig(config);

