import { Button, Chip, Drawer } from "@heroui/react";
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
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);
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
          <Button isIconOnly variant="tertiary" onPress={toggleTheme}>
            {theme === "light" ? <BiSun /> : <BiMoon />}
          </Button>
          <Button isIconOnly variant="tertiary" onPress={handleOpen}>
            <BiCog />
          </Button>
          <Drawer>
            <Button isIconOnly className="lg:hidden">
              <BiMenu />
            </Button>
            <Drawer.Backdrop>
              <Drawer.Content placement="left" className="max-w-xs">
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
                    <Navigation />
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
      className="hidden lg:block w-86 h-full border-r border-default-100 overflow-y-auto"
    >
      <Navigation />
    </div>
  );
}

function Navigation() {
  const { arcs, isEpisodePlayed, toggleEpisodePlayed } = useDataContext();
  const [openTab, setOpenTab] = useState<number | null>(null);
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (arcId: string, episodeId?: string) =>
      navigate(`/${arcId}${episodeId ? `/${episodeId}` : ""}`),
    [navigate],
  );

  const handleJumpToArc = (arcId: string) => {
    document.getElementById("accordion")?.scrollTo({
      top: document.getElementById(arcId)?.offsetTop,
      behavior: "smooth",
    });
  };

  const isArcFinished = useCallback(
    (arcItem: (typeof arcs)[0]) => {
      return (
        arcItem.episodes.length > 0 &&
        arcItem.episodes.every((ep) => isEpisodePlayed(arcItem.id, ep.id))
      );
    },
    [isEpisodePlayed],
  );

  const AccordionItems = useMemo(() => {
    return arcs?.map((item, index) => {
      const arcFinished = isArcFinished(item);
      return (
        <Accordion.Item
          key={index}
          className={`${arcFinished ? " " : ""}`}
        >
          <Accordion.Heading>
            <Accordion.Trigger
              className={`${openTab === null ? "opacity-100" : openTab === index ? "opacity-100" : "opacity-50"} hover:opacity-100`}
              onPress={() => {
                setOpenTab(openTab === index ? null : index);
                handleJumpToArc(item.id.toString());
              }}
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
                className={`dark:text-white text-black ${arcFinished ? " " : ""}`}
              >
                {item.title}
              </span>
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
                className=" rounded-lg mb-2 w-full h-auto"
              />
              <h3 className=" text-2xl font-semibold dark:text-white text-black">
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

              <div className="flex flex-col gap-2">
                {openTab === index &&
                  item.episodes.map((episode, epIndex) => {
                    const epFinished = isEpisodePlayed(item.id, episode.id);
                    return (
                      <span
                        key={`${item.title}-${epIndex}`}
                        className="flex items-center gap-1"
                      >
                        <Button
                          variant="ghost"
                          isIconOnly
                          size="sm"
                          className="size-4 shrink-0 text-muted w-5 h-5 rounded-md flex items-center justify-center hover:bg-default/20 cursor-pointer"
                          onPress={() => toggleEpisodePlayed(item.id, episode.id)}
                          aria-label={epFinished ? "Mark as unplayed" : "Mark as played"}
                        >
                          {epFinished ? (
                            <BiCheck className="size-4 text-green-500" />
                          ) : (
                            <p className="text-xs">{epIndex + 1}.</p>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          className={`w-full justify-start rounded-lg px-2 flex items-center ${epFinished ? "opacity-70" : "dark:text-white text-black"}`}
                          onPress={() =>
                            handleNavigate(
                              item.id.toString(),
                              episode.id.toString(),
                            )
                          }
                        >
                          <span
                            className={`flex items-center gap-1 ${epFinished ? "line-through opacity-70" : ""}`}
                          >
                            {item.title} Episode {episode.id}
                          </span>
                        </Button>
                      </span>
                    );
                  })}
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      );
    });
  }, [openTab, arcs, isEpisodePlayed, toggleEpisodePlayed, isArcFinished, handleNavigate]);

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
