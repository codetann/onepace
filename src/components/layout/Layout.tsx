import {
  Button,
  Checkbox,
  Chip,
  Input,
  InputGroup,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { Link, useLocation, useNavigate } from "react-router";
import { Drawer } from "@heroui/react";
import {
  BiMenu,
  BiHome,
  BiSearch,
  BiPlay,
  BiListUl,
  BiSun,
  BiMoon,
  BiUser,
  BiExpand,
  BiExpandAlt,
  BiChevronDown,
  BiCog,
  BiCheck,
  BiTv,
  BiBook,
  BiStar,
  BiInfoCircle,
  BiLink,
  BiLinkExternal,
  BiArrowToRight,
  BiRightArrow,
  BiRightArrowAlt,
} from "react-icons/bi";
import { useEffect, useState, useMemo } from "react";
import { useArcs, useTheme } from "@/hooks";
import { Accordion } from "@heroui/react";
import { BsFillEyeFill } from "react-icons/bs";
import { FiClock } from "react-icons/fi";
import { DATA } from "@/data/data";
import { useArcData } from "@/hooks";
import { useDataContext } from "@/context";
import { jellyfinClient } from "@/api/jellyfin/client";
import { SettingsModal } from "../settings-modal";
import logo from "../../../assets/logo.svg";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col  h-screen">
      <Header />
      <section className="flex h-full overflow-hidden">
        <SideMenu />
        <Content>{children}</Content>
      </section>
    </div>
  );
}

function Header() {
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);
  return (
    <>
      <nav className="w-full min-h-16 border-b border-default-100 flex items-center justify-between px-4">
        <span>
          <h4 className="text-2xl font-bold flex-1">One Pace</h4>
        </span>

        <div className="flex items-center gap-2 flex-1 justify-end">
          <Select className="w-[8rem]" placeholder="Select one" value="dubbed">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="dubbed" textValue="Dubbed">
                  Dub
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="subbed" textValue="Subbed">
                  Sub
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
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
                    <Drawer.Heading>Drawer Title</Drawer.Heading>
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

function Search() {
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <>
      {/* <InputGroup onClick={handleOpen} className="w-full max-w-[280px]">
        <InputGroup.Prefix>
          <BiSearch className="size-4 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input placeholder="Search" />
      </InputGroup> */}
      <Button
        onPress={handleOpen}
        className="w-full rounded-xl flex-2 max-w-[300px]"
        variant="outline"
      >
        <BiSearch className="size-4" />
        Search
      </Button>
      <Modal isOpen={isOpen} onOpenChange={handleClose}>
        <Modal.Backdrop>
          <Modal.Container placement="top" size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <InputGroup className="w-full ">
                  <InputGroup.Prefix>
                    <BiSearch className="size-4 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input placeholder="Search" autoFocus />
                </InputGroup>
                <Modal.Heading></Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>Search for your favorite anime.</p>
              </Modal.Body>
              <Modal.Footer>
                <Button className="w-full" slot="close">
                  Continue
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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
  const { arcs } = useDataContext();
  console.log("rendered");
  const [openTab, setOpenTab] = useState<number | null>(null);
  const [watched, setWatched] = useState<string[]>(["129-132", "132-135"]);
  const [finished, setFinished] = useState<string[]>(["Drum Island"]);
  const navigate = useNavigate();
  const handleNavigate = (arcId: string, episodeId?: string) =>
    navigate(`/${arcId}${episodeId ? `/${episodeId}` : ""}`);

  const handleFinish = (id: string) => {
    jellyfinClient.updateItem(id, {
      IsPlayed: true,
    });
  };
  const handleWatch = (episode: string) => {
    if (watched.includes(episode)) {
      setWatched(watched.filter((item) => item !== episode));
    } else {
      setWatched([...watched, episode]);
    }
  };

  const handleJumpToArc = (arcId: string) => {
    document.getElementById("accordion")?.scrollTo({
      top: document.getElementById(arcId)?.offsetTop,
      behavior: "smooth",
    });
  };

  const AccordionItems = useMemo(() => {
    return arcs?.map((item, index) => (
      <Accordion.Item
        key={index}
        className={`${finished.includes(item.title) ? " " : ""}`}
      >
        <Accordion.Heading>
          <Accordion.Trigger
            className={`${openTab === null ? "opacity-100" : openTab === index ? "opacity-100" : "opacity-50"} hover:opacity-100`}
            onPress={() => {
              setOpenTab(openTab === index ? null : index);
              handleJumpToArc(item.id.toString());
            }}
          >
            {finished.includes(item.title) && (
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className="mr-2 size-4 shrink-0 text-green-500 w-5 h-5 bg-green-500/10 rounded-md flex items-center justify-center"
                onPress={() => handleFinish(item.title)}
              >
                <BiCheck />
              </Button>
            )}
            {!finished.includes(item.title) ? (
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className="mr-2 size-4 shrink-0 text-muted w-5 h-5  rounded-md flex items-center justify-center"
                onPress={() => handleFinish(item.title)}
              >
                {index + 1}
              </Button>
            ) : null}
            <span
              id={item.id.toString()}
              className={`dark:text-white text-black ${finished.includes(item.title) ? " " : ""}`}
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
              {/* <Checkbox id="basic-terms">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content></Checkbox.Content>
              </Checkbox> */}
            </span>
            <p className="pb-3 pt-2 ">{item.description}</p>

            <div className="flex flex-col gap-2">
              {openTab === index &&
                item.episodes.map((episode, index) => (
                  <span
                    key={`${item.title}-${index}`}
                    className="flex items-center gap-1"
                  >
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      className="size-4 shrink-0 text-muted w-5 h-5  rounded-md flex items-center justify-center"
                      // onPress={() => handleWatch(episode.id)}
                    >
                      {watched.includes(episode.id) ? (
                        <BiCheck className="size-4 text-green-500" />
                      ) : (
                        <p>{index + 1}.</p>
                      )}
                    </Button>
                    <Button
                      key={`${item.title}-${index}`}
                      variant="ghost"
                      className={`w-full justify-start rounded-lg px-2 flex items-center ${watched.includes(episode.id) ? " dark:text-white text-black" : ""}`}
                      onPress={() =>
                        handleNavigate(
                          item.id.toString(),
                          episode.id.toString(),
                        )
                      }
                    >
                      {" "}
                      <span
                        className={`flex items-center gap-1 ${watched.includes(episode.id) ? "line-through opacity-70" : ""}`}
                      >
                        {episode.title}
                      </span>
                      {/* <Chip
                      size="sm"
                      color="default"
                      className="ml-auto gap-1"
                    >
                      <FiClock className="size-3" /> 42.12
                    </Chip> */}
                      {/* <span className="text-blue-500 ml-auto">{episode}</span> */}
                    </Button>
                  </span>
                ))}
            </div>
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    ));
  }, [openTab, finished, watched, arcs]);

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
