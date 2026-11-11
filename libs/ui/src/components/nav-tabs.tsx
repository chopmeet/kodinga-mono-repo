import { ReactNode, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

export type Tab = {
    id: string,
    title: string,
    link: string,
    icon?: ReactNode,
}

/**
 * The tabs scroll sideways on narrow screens: bring the active one into view, else on mobile the
 * current tab (often the last one) stays hidden off-screen. scrollLeft only, never the page.
 */
function useActiveTabInView(pathname: string) {
    const ref = useRef<HTMLUListElement>(null);
    useEffect(() => {
        const list = ref.current;
        const active = list?.querySelector<HTMLElement>(".tab_item__active");
        if (!list || !active) return;
        const left = active.offsetLeft - list.offsetLeft;
        if (left < list.scrollLeft || left + active.offsetWidth > list.scrollLeft + list.clientWidth) {
            list.scrollLeft = left - (list.clientWidth - active.offsetWidth) / 2;
        }
    }, [pathname]);
    return ref;
}

function NavTabs({
    tabs, 
    wrapperClass,
}: {
    tabs: Tab[],
    wrapperClass?: string,
}) {
    const { pathname } = useLocation();
    const listRef = useActiveTabInView(pathname);
    return (
        <div className="custom_tabs__wrapper">
            <div className="border-b border-slate-200 dark:border-slate-800 mb-8">
                <ul ref={listRef} className={`flex list-none p-0 flex-nowrap gap-2 overflow-x-auto tabs__container mb-0 ${wrapperClass}`}>
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
    const listRef = useActiveTabInView(pathname);
    return (
        <div className="mb-8 custom_tabs__wrapper">
            <ul ref={listRef} className={`flex list-none p-0 flex-nowrap overflow-x-auto tabs__container mb-0 ${wrapperClass}`}>
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
    const listRef = useActiveTabInView(pathname);
    return (
        <div className="custom_tabs__wrapper">
            <ul ref={listRef} className={`flex list-none p-0 flex-nowrap gap-2 overflow-x-auto tabs__container mb-0 rounded-lg bg-white/90 shadow-2xl ${wrapperClass}`}>
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



export { 
    NavTabs,
    RoundedNavTabs,
    FloatedNavTabs,
    
};
