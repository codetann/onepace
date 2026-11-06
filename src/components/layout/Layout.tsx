import { Button, Chip, Drawer, Tooltip } from "@heroui/react";
import { useNavigate } from "react-router";
import {
  BiMenu,
  BiSun,
  BiMoon,
  BiChevronDown,
  BiCog,
  BiCheck,
  BiTv,
  BiBook,
  BiStar,
  BiRightArrowAlt,
  BiPlayCircle,
} from "react-icons/bi";
import { useState, useMemo, useCallback } from "react";
import { useTheme } from "@/hooks";
import { Accordion } from "@heroui/react";
import { useDataContext } from "@/context";
import { SettingsModal } from "../settings-modal";

interface LayoutProps {
  children: React.ReactNode;
  showSideMenu?: boolean;
  showHeader?: boolean;
}

export default function Layout({
  children,
  showSideMenu = true,
  showHeader = true,
}: LayoutProps) {
  return (
    <div className="flex flex-col  h-screen">
      {showHeader && <Header />}
      <section className="flex h-full overflow-hidden">
        {showSideMenu && <SideMenu />}
        <Content>{children}</Content>
      </section>
    </div>
  );
}

function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, getContinueWatchingTarget } = useDataContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const handleContinueWatching = () => {
    const target = getContinueWatchingTarget();
    navigate(`/${target.arcId}/${target.episodeId}`);
  };

  const continueTarget = useMemo(() => {
    return getContinueWatchingTarget();
  }, [getContinueWatchingTarget]);

  const continueTooltip = continueTarget
    ? `Continue: ${continueTarget.arcTitle || `Arc ${continueTarget.arcId}`} - ${continueTarget.episodeTitle || `Ep ${continueTarget.episodeId}`}`
    : "Continue Watching";

  return (
    <>
      <nav className="w-full min-h-16 border-b border-default-100 flex items-center justify-between px-4">
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => navigate("/1")}
        >
          <img
            src="/straw-hat-logo.png"
            alt="One Pace Logo"
            className="w-9 h-9 object-contain"
          />
          <h4 className="text-2xl font-bold tracking-tight">One Pace</h4>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end">
          {user && (
            <Tooltip delay={300}>
              <Tooltip.Trigger>
                <Button
                  variant="secondary"
                  size="sm"
                  className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold px-2.5 h-8 rounded-lg shadow-sm border border-default-200 hover:bg-default-100"
                  onPress={handleContinueWatching}
                  aria-label={continueTooltip}
                >
                  <BiPlayCircle className="size-4 text-accent" />
                  <span className="hidden sm:inline">Continue Watching</span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom">
                {continueTooltip}
              </Tooltip.Content>
            </Tooltip>
          )}

          <Button isIconOnly variant="tertiary" onPress={toggleTheme}>
            {theme === "light" ? <BiSun /> : <BiMoon />}
          </Button>
          <Button isIconOnly variant="tertiary" onPress={handleOpen}>
            <BiCog />
          </Button>
          <Drawer isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <Button
              isIconOnly
              className="lg:hidden cursor-pointer"
              onPress={() => setIsDrawerOpen(true)}
            >
              <BiMenu />
            </Button>
            <Drawer.Backdrop>
              <Drawer.Content placement="left" className="w-[88vw] max-w-sm sm:max-w-md">
                <Drawer.Dialog className="px-2 pb-2">
                  <Drawer.Header>
                    <Drawer.Heading className="flex items-center gap-2">
                      <img
                        src="/straw-hat-logo.png"
                        alt="One Pace Logo"
                        className="w-6 h-6 object-contain"
                      />
                      One Pace
                    </Drawer.Heading>
                  </Drawer.Header>
                  <Drawer.Body>
                    <Navigation onNavigate={() => setIsDrawerOpen(false)} />
                  </Drawer.Body>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
        </div>
      </nav>
      <SettingsModal isOpen={isOpen} onOpenChange={handleClose} />
    </>
  );
}

function SideMenu() {
  return (
    <div
      id="side-menu"
      className="hidden lg:block w-[22.5rem] h-full border-r border-default-100 overflow-y-auto shrink-0"
    >
      <Navigation />
    </div>
  );
}

interface NavigationProps {
  onNavigate?: () => void;
}

function Navigation({ onNavigate }: NavigationProps) {
  const { arcs, isEpisodePlayed, toggleEpisodePlayed, isArcFinished, toggleArcPlayed } =
    useDataContext();
  const [openTab, setOpenTab] = useState<number | null>(null);
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (arcId: string, episodeId?: string) => {
      navigate(`/${arcId}${episodeId ? `/${episodeId}` : ""}`);
      onNavigate?.();
    },
    [navigate, onNavigate],
  );

  const handleJumpToArc = (arcId: string) => {
    document.getElementById("accordion")?.scrollTo({
      top: document.getElementById(arcId)?.offsetTop,
      behavior: "smooth",
    });
  };

  const AccordionItems = useMemo(() => {
    return arcs?.map((item, index) => {
      const arcFinished = isArcFinished(item);
      return (
        <Accordion.Item
          key={index}
          className={`${arcFinished ? " " : ""}`}
        >
          <Accordion.Heading
            className={`flex items-center justify-between w-full ${
              openTab === null
                ? "opacity-100"
                : openTab === index
                  ? "opacity-100"
                  : "opacity-50"
            } hover:opacity-100 transition-opacity`}
          >
            <button
              type="button"
              className="flex items-center flex-1 min-w-0 text-left py-3 px-3 cursor-pointer group hover:bg-default/10 rounded-lg transition-colors"
              onClick={() => handleNavigate(item.id.toString())}
              aria-label={`Go to ${item.title} arc page`}
            >
              {arcFinished ? (
                <div
                  className="mr-2 size-4 shrink-0 text-green-500 w-5 h-5 bg-green-500/10 rounded-md flex items-center justify-center"
                >
                  <BiCheck />
                </div>
              ) : (
                <div
                  className="mr-2 size-4 shrink-0 text-muted w-5 h-5 rounded-md flex items-center justify-center text-xs"
                >
                  {index + 1}
                </div>
              )}
              <span
                id={item.id.toString()}
                className={`dark:text-white text-black font-medium text-sm group-hover:underline group-hover:text-accent underline-offset-2 transition-all ${
                  arcFinished ? " " : ""
                }`}
              >
                {item.title}
              </span>
            </button>
            <Accordion.Trigger
              className="p-3 mr-1 cursor-pointer text-muted hover:text-white rounded-lg hover:bg-default/10 transition-colors"
              onPress={() => {
                setOpenTab(openTab === index ? null : index);
                handleJumpToArc(item.id.toString());
              }}
              aria-label={`Toggle ${item.title} episodes dropdown`}
            >
              <Accordion.Indicator>
                <BiChevronDown />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <img
                src={item.altImage || item.image}
                alt={item.title}
                className="rounded-lg mb-2 w-full h-auto cursor-pointer transition-opacity hover:opacity-90 active:scale-[0.99]"
                onClick={() => handleNavigate(item.id.toString())}
              />
              <h3
                className="text-2xl font-semibold dark:text-white text-black cursor-pointer hover:underline"
                onClick={() => handleNavigate(item.id.toString())}
              >
                {item.title}
              </h3>
              <span className="flex justify-between items-center w-full ">
                <span className="flex items-center  my-2 gap-1 ">
                  <Chip color="warning" size="sm">
                    <BiStar className="size-4" />
                    {item.averageRating}
                  </Chip>

                  <Chip color="default" className="gap-1" size="sm">
                    <BiBook />
                    {item.coverage?.manga}
                  </Chip>
                  <Chip color="default" className="gap-1" size="sm">
                    <BiTv />
                    {item.coverage?.anime}
                  </Chip>
                </span>

                <Button
                  variant="tertiary"
                  isIconOnly
                  className="size-6"
                  onPress={() => handleNavigate(item.id.toString())}
                >
                  <BiRightArrowAlt className="size-4" />
                </Button>
              </span>
              <p className="pb-3 pt-2 ">{item.description}</p>

              <div className="flex items-center justify-between pb-2 pt-1 border-t border-default-100">
                <span className="text-xs text-muted font-medium">
                  Episodes ({item.episodes.length})
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`text-xs h-7 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                    arcFinished
                      ? "text-green-500 hover:text-red-400 hover:bg-red-500/10"
                      : "text-muted hover:text-green-400 hover:bg-green-500/10"
                  }`}
                  onPress={() => toggleArcPlayed(item.id)}
                  aria-label={
                    arcFinished
                      ? "Mark season as unplayed"
                      : "Mark season as complete"
                  }
                >
                  <BiCheck className="size-4" />
                  {arcFinished ? "Season Completed" : "Mark Season Complete"}
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                {openTab === index &&
                  item.episodes.map((episode, epIndex) => {
                    const epFinished = isEpisodePlayed(item.id, episode.id);
                    const episodeTitle =
                      episode.altTitle || `${item.title} Episode ${episode.id}`;

                    return (
                      <div
                        key={`${item.title}-${epIndex}`}
                        className="flex items-center gap-1.5 w-full"
                      >
                        <Button
                          variant="ghost"
                          isIconOnly
                          size="sm"
                          className="size-5 shrink-0 text-muted rounded-md flex items-center justify-center hover:bg-default/20 cursor-pointer"
                          onPress={() => toggleEpisodePlayed(item.id, episode.id)}
                          aria-label={epFinished ? "Mark as unplayed" : "Mark as played"}
                        >
                          {epFinished ? (
                            <BiCheck className="size-4 text-green-500" />
                          ) : (
                            <p className="text-[11px] font-medium">{epIndex + 1}.</p>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          className={`flex-1 justify-start text-left h-auto py-2 px-2.5 rounded-lg flex items-center min-w-0 ${
                            epFinished ? "opacity-70" : "dark:text-white text-black"
                          }`}
                          onPress={() =>
                            handleNavigate(
                              item.id.toString(),
                              episode.id.toString(),
                            )
                          }
                        >
                          <span
                            className={`text-xs font-medium leading-relaxed break-words line-clamp-2 ${
                              epFinished ? "line-through opacity-70" : ""
                            }`}
                            title={episodeTitle}
                          >
                            {episodeTitle}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      );
    });
  }, [
    openTab,
    arcs,
    isEpisodePlayed,
    toggleEpisodePlayed,
    isArcFinished,
    toggleArcPlayed,
    handleNavigate,
  ]);

  if (!arcs) return <div>Loading...</div>;

  return (
    <div
      id="accordion"
      className="flex flex-col  justify-between overflow-y-auto"
    >
      <Accordion className="w-full h-full overflow-y-auto">
        {AccordionItems}
      </Accordion>
    </div>
  );
}

interface ContentProps {
  children: React.ReactNode;
}
function Content({ children }: ContentProps) {
  return (
    <div id="content" className="flex-1 p-1 sm:p-4 overflow-y-auto ">
      {children}
    </div>
  );
}
