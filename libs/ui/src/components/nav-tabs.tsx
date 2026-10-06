import { ReactNode } from "react";
import { BiTrip } from "react-icons/bi";
import { FaCity, FaMoneyCheck, FaQuestionCircle, FaRoute, FaServicestack, FaUndoAlt, FaUsers } from "react-icons/fa";
import { FaPeopleGroup } from "react-icons/fa6";
import { FiBox, FiPackage } from "react-icons/fi";
import { HiOutlineClipboardDocumentList, HiOutlineCog, HiOutlineDocumentCheck, HiOutlineDocumentText } from "react-icons/hi2"
import { LuTypeOutline } from "react-icons/lu";
import { MdDirectionsBus, MdMap, MdOutlineCategory, MdSupport } from "react-icons/md";
import { TbBus } from "react-icons/tb";
import { NavLink, useLocation } from "react-router-dom";

type Tab = {
    id: string,
    title: string,
    link: string,
    icon?: ReactNode,
}

function NavTabs({
    tabs, 
    wrapperClass,
}: {
    tabs: Tab[],
    wrapperClass?: string,
}) {
    const { pathname } = useLocation();
    return (
        <div className="custom_tabs__wrapper">
            <div className="border-b border-slate-200 dark:border-slate-800 mb-8">
                <ul className={`flex list-none p-0 flex-nowrap gap-2 overflow-x-auto tabs__container mb-0 ${wrapperClass}`}>
                    {tabs.map((tab, key) => (
                        <NavLink
                            role="button"
                            className={`flex items-center text-[#586A84] text-base font-medium leading-[22px] py-3.5 px-4 relative text-center text-nowrap tab_item 
                            ${pathname?.includes(tab?.link)
                                ? "bg-white shadow-[inset_0_-3px_0_0_#2d3748] tab_item__active"
                                : ""
                            }`}
                            to={`${tab.link}`}
                            key={key}
                            title={tab.title}
                        >
                            {!!tab?.icon && <span className="pe-2">{tab?.icon}</span>}
                            <span>{tab.title}</span>
                        </NavLink>
                    ))}
                </ul>
            </div>
        </div>
    );
};

function RoundedNavTabs({
    tabs, 
    wrapperClass,
}: {
    tabs: Tab[],
    wrapperClass?: string,
}) {
    const { pathname } = useLocation();
    return (
        <div className="mb-8 custom_tabs__wrapper">
            <ul className={`flex list-none p-0 flex-nowrap overflow-x-auto tabs__container mb-0 ${wrapperClass}`}>
                {tabs.map((tab, key) => (
                    <NavLink
                        role="button"
                        className={`flex items-center text-[#586A84] text-base font-medium leading-[22px] py-3.5 px-4 relative text-center text-nowrap tab_item 
                            border border-primary first:rounded-l-4xl last:rounded-r-4xl
                            ${pathname?.includes(tab?.link)
                                ? "bg-primary text-white tab_item__active"
                                : ""
                            }
                        `}
                        to={`${tab.link}`}
                        key={key}
                        title={tab.title}
                    >
                        {!!tab?.icon && <span className="pe-2">{tab?.icon}</span>}
                        <span>{tab.title}</span>
                    </NavLink>
                ))}
            </ul>
        </div>
    );
};

function FloatedNavTabs({
    tabs, 
    wrapperClass,
}: {
    tabs: Tab[],
    wrapperClass?: string,
}) {
    const { pathname } = useLocation();
    return (
        <div className="custom_tabs__wrapper">
            <ul className={`flex list-none p-0 flex-nowrap gap-2 overflow-x-auto tabs__container mb-0 rounded-lg bg-white/90 shadow-2xl ${wrapperClass}`}>
                {tabs.map((tab, key) => (
                    <NavLink
                        role="button"
                        className={`flex items-center text-base font-medium leading-[22px] py-2 px-4 relative text-center text-nowrap rounded-lg grow justify-center tab_item 
                        ${pathname?.includes(tab?.link)
                            ? "bg-primary text-white tab_item__active"
                            : ""
                        }`}
                        to={`${tab.link}`}
                        key={key}
                        title={tab.title}
                    >
                        {!!tab?.icon && <span className="pe-2">{tab?.icon}</span>}
                        <span>{tab.title}</span>
                    </NavLink>
                ))}
            </ul>
        </div>
    );
};


const settingsTabsData: Tab[] = [
    {
        id: 'setting-admins',
        title: 'Administrateurs',
        link: '/admin/settings/administrators',
        icon: <FaPeopleGroup />
    },
    {
        id: 'setting-tou',
        title: 'Conditions d\'utilisation',
        link: '/admin/settings/terms-of-use',
        icon: <HiOutlineDocumentCheck />
    },
    {
        id: 'setting-pp',
        title: 'Politique de confidentialité',
        link: '/admin/settings/privacy-policy',
        icon: <HiOutlineDocumentText />
    },
    {
        id: 'setting-pp',
        title: 'Politique de remboursement',
        link: '/admin/settings/refund-policy',
        icon: <FaUndoAlt />
    },
    {
        id: 'setting-options',
        title: 'Options',
        link: '/admin/settings/options',
        icon: <HiOutlineCog/>
    },
];

const hcForDesignatedUsersTabsData: Tab[] = [
    {
        id: 'faq-for-companies',
        title: 'Pour les compagnies',
        link: '/hc/for-companies',
        icon: <MdDirectionsBus />
    },
    {
        id: 'faq-for-users',
        title: 'Pour les utilisateurs',
        link: '/hc/for-users',
        icon: <FaUsers />
    },
];

const travelerDetailsNavTabsData: Tab[] = [
    {
        id: 'overview',
        title: 'Vue d\'ensemble',
        link: 'overview',
    },
    {
        id: 'booking-history',
        title: 'Réservations',
        link: 'reservations',
    },
    {
        id: 'subscriptions',
        title: 'Abonnements',
        link: 'subscriptions',
    },
    {
        id: 'support',
        title: 'Support',
        link: 'support',
    },
];

const companyDetailsNavTabsData: Tab[] = [
    {
        id: "lines",
        title: "Trajets",
        link: "lines",
        icon: <FaRoute />,
    },
    {
        id: "buses",
        title: "Flotte",
        link: "fleet",
        icon: <MdDirectionsBus />,
    },
    {
        id: "company-trips",
        title: "Départs",
        link: "trips",
        icon: <BiTrip />,
    },
    {
        id: 'passengers',
        title: 'Passagers',
        link: 'passengers',
        icon: <FaUsers />,
    },
    {
        id: 'booking-history',
        title: 'Réservations',
        link: 'reservations',
        icon: <HiOutlineClipboardDocumentList />
    },
    {
        id: 'subscriptions',
        title: 'Abonnements',
        link: 'subscriptions',
        icon: <FaMoneyCheck />,
    },
    {
        id: 'staff',
        title: 'Membres du staff',
        link: 'staff',
        icon: <FaUsers />
    },
    {
        id: 'parcels',
        title: 'Colis',
        link: 'parcels',
        icon: <FiPackage />,
    },
    {
        id: 'support',
        title: 'Support',
        link: 'support',
        icon: <MdSupport />,
    },
];

const companyLinesNavTabsData: Tab[] = [
    {
        id: 'lines',
        title: 'Tout les trajets',
        link: '/company/lines/all',
    },
    {
        id: 'stops',
        title: 'Arrêts',
        link: '/company/lines/stops',
    },
] 

const resourceNavTabsData: Tab[] = [
    {
        id: 'regions',
        title: 'Régions',
        link: 'regions',
        icon: <MdMap />
    },
    {
        id: 'cities',
        title: 'Villes',
        link: 'cities',
        icon: <FaCity />
    },
    {
        id: 'type-companies',
        title: 'Type de companies',
        link: 'type-companies',
        icon: <LuTypeOutline />
    },
    {
        id: 'type-buses',
        title: 'Type de Bus',
        link: 'type-buses',
        icon: <TbBus />
    },
    {
        id: 'type-parcels',
        title: 'Type de colis',
        link: 'type-parcels',
        icon: <FiBox />
    },
    {
        id: 'bus-services',
        title: 'Services',
        link: 'bus-services',
        icon: <FaServicestack />
    },
    {
        id: 'categories',
        title: 'Catégories',
        link: 'categories',
        icon: <MdOutlineCategory />
    },
    {
        id: 'faqs',
        title: 'FAQs',
        link: 'faqs',
        icon: <FaQuestionCircle />
    },
] 

const subscriptionNavTabsData: Tab[] = [
    {
        id: 'subscriptions',
        title: 'Abonnements',
        link: '/company/subscriptions-and-payments/subscriptions',
    },
    {
        id: 'plans',
        title: 'Plans d\'abonnement',
        link: '/company/subscriptions-and-payments/plans',
    },
] 

const scannerNavTabsData: Tab[] = [
    {
        id: 'scan-ticket',
        title: 'Scan',
        link: 'scanner',
    },
    {
        id: 'scanned-tickets',
        title: 'Historique',
        link: 'scanned-tickets-history',
    },
]

const tripNavTabsData: Tab[] = [
    {
        id: 'to-activate',
        title: 'À activer',
        link: 'to-activate',
    },
    {
        id: 'actives-histories',
        title: 'Actifs / historique',
        link: 'active-or-history',
    },
]


function SettingNavTabs() {
    return (
        <NavTabs tabs={settingsTabsData} wrapperClass="setting__nav_tabs" />
    )
}

function ResourceNavTabs() {
    return (
        <NavTabs tabs={resourceNavTabsData} wrapperClass="resource__nav_tabs" />
    )
}

function HCNavTabs() {
    return (
        <NavTabs tabs={hcForDesignatedUsersTabsData} wrapperClass="hc__nav_tabs justify-center" />
    )
}

function TravelerDetailsNavTabs() {
    return (
        <NavTabs tabs={travelerDetailsNavTabsData} wrapperClass="traveler_details__nav_tabs" />
    )
}

function CompanyDetailsNavTabs() {
    return (
        <NavTabs tabs={companyDetailsNavTabsData} wrapperClass="company_details__nav_tabs" />
    )
}

function CompanyLinesNavTabs() {
    return (
        <NavTabs tabs={companyLinesNavTabsData} wrapperClass="company_lines__nav_tabs" />
    )
}

function SubscriptionNavTabs() {
    return (
        <RoundedNavTabs tabs={subscriptionNavTabsData} wrapperClass="subscriptions__nav_tabs" />
    )
}

function ScannerNavTabs() {
    return (
        <FloatedNavTabs tabs={scannerNavTabsData} wrapperClass="scanner__nav_tabs" />
    )
}

function TripNavTabs() {
    return (
        <NavTabs tabs={tripNavTabsData} wrapperClass="trip__nav_tabs" />
    )
}


export { 
    SettingNavTabs,
    ResourceNavTabs,
    HCNavTabs,
    TravelerDetailsNavTabs,
    CompanyDetailsNavTabs,
    CompanyLinesNavTabs,
    SubscriptionNavTabs,
    ScannerNavTabs,
    TripNavTabs,
    
 };
