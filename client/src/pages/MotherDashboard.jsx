import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { motherApi, childApi } from '../api/endpoints.js';
import Layout from '../components/Layout.jsx';
import Loader from '../components/Loader.jsx';
import ContactDoctorButton from '../components/ContactDoctorButton.jsx';
import MedicationAlarm from '../components/MedicationAlarm.jsx';
import PregnancyTab from '../mother/PregnancyTab.jsx';
import SymptomsTab from '../mother/SymptomsTab.jsx';
import VaccinesTab from '../mother/VaccinesTab.jsx';
import GrowthTab from '../mother/GrowthTab.jsx';
import MedicationsTab from '../mother/MedicationsTab.jsx';
import ChatbotTab from '../mother/ChatbotTab.jsx';
import ProfileTab from '../mother/ProfileTab.jsx';
import { setGenderTheme } from '../theme.js';

const tabs = [
  { key: 'pregnancy', label: 'حملي' },
  { key: 'symptoms', label: 'الأعراض' },
  { key: 'vaccines', label: 'التطعيمات' },
  { key: 'growth', label: 'النمو' },
  { key: 'medications', label: 'الأدوية' },
  { key: 'chat', label: 'اسألي رفيقة' },
  { key: 'profile', label: 'ملفي' },
];

export default function MotherDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('pregnancy');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeChildId, setActiveChildId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [profile, children] = await Promise.all([motherApi.profile(), childApi.list()]);
      setData({ ...profile, children: children.children });
      setActiveChildId((prev) => {
        const list = children.children;
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id || null;
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'تعذّر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const children = data?.children || [];
  const activeChild = children.find((c) => c.id === activeChildId) || children[0] || null;

  useEffect(() => {
    setGenderTheme(activeChild?.gender);
  }, [activeChild?.gender]);

  if (loading) return <Loader full label="جارٍ تحميل رحلتك..." />;

  return (
    <Layout
      title={`أهلاً ${user.name}`}
      subtitle="رحلتك من الحمل حتى اكتمال تطعيمات طفلك ونموه"
      actions={<ContactDoctorButton doctor={data?.doctor} />}
    >
      {error && <div className="alert critical">{error}</div>}

      <MedicationAlarm />

      {children.length > 0 && (
        <div className="child-switch">
          <span className="cs-label">اختاري المولود:</span>
          {children.map((c) => (
            <button
              key={c.id}
              className={`child-chip ${activeChild?.id === c.id ? 'active' : ''}`}
              onClick={() => setActiveChildId(c.id)}
            >
              <span className={`g-dot ${c.gender}`} />
              {c.name}
              <span className="small">{c.gender === 'female' ? 'بنت' : 'ولد'}</span>
            </button>
          ))}
          <span className="small muted">الألوان تتغير حسب النوع تلقائيًا.</span>
        </div>
      )}

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pregnancy' && <PregnancyTab data={data} reload={load} />}
      {tab === 'symptoms' && <SymptomsTab />}
      {tab === 'vaccines' && (
        <VaccinesTab data={{ ...data, children }} childId={activeChild?.id} onSelectChild={setActiveChildId} reload={load} />
      )}
      {tab === 'growth' && (
        <GrowthTab data={{ ...data, children }} childId={activeChild?.id} onSelectChild={setActiveChildId} reload={load} />
      )}
      {tab === 'medications' && <MedicationsTab data={{ ...data, children }} reload={load} />}
      {tab === 'chat' && <ChatbotTab />}
      {tab === 'profile' && <ProfileTab data={data} reload={load} />}
    </Layout>
  );
}
